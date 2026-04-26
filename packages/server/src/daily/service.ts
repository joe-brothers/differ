import { z } from "zod";
import { eq } from "drizzle-orm";
import { Puzzle, RectArea, PUZZLES_PER_GAME, DIFFS_PER_PUZZLE } from "@differ/shared";
import type { Env } from "../env.js";
import { getDb } from "../db/client.js";
import { dailyPuzzles, puzzles } from "../db/schema.js";
import type { RoundPuzzle } from "../puzzles/service.js";

// Stored shape: array of { puzzleId, diffIds[] }. Loaded back into RoundPuzzle
// by re-fetching the underlying puzzle rows so path/extension/allDiffs follow
// any later puzzle-row edits (image swaps, diff fixes) — only the selection
// is frozen, not the puzzle content.
const StoredDailySet = z.array(
  z.object({
    puzzleId: z.string(),
    diffIds: z.array(z.string()).length(DIFFS_PER_PUZZLE),
  }),
);
type StoredDailySet = z.infer<typeof StoredDailySet>;

const StoredDifferences = z.array(RectArea);

// `YYYY-MM-DD` in UTC, e.g. "2026-04-26". Single source of truth for the
// daily-key boundary; all clients see the same set regardless of timezone.
export function utcDateKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// Pick 5 puzzles from the pool and 5 diffs from each. Stored verbatim so the
// same set is replayed for every player on the same UTC date. Throws if the
// pool is too small to satisfy the round.
async function pickDailySet(env: Env): Promise<StoredDailySet> {
  const db = getDb(env.DB);
  const rows = await db.select({ id: puzzles.id, differences: puzzles.differences }).from(puzzles);

  const eligible: { id: string; diffIds: string[] }[] = [];
  for (const row of rows) {
    const parsed = StoredDifferences.safeParse(JSON.parse(row.differences));
    if (!parsed.success) continue;
    const ids = parsed.data.filter((d) => d.w > 0 && d.h > 0).map((d) => d.id);
    if (ids.length >= DIFFS_PER_PUZZLE) eligible.push({ id: row.id, diffIds: ids });
  }
  if (eligible.length < PUZZLES_PER_GAME) {
    throw new Error(
      `daily: not enough puzzles (have ${eligible.length}, need ${PUZZLES_PER_GAME})`,
    );
  }
  return shuffle(eligible)
    .slice(0, PUZZLES_PER_GAME)
    .map((p) => ({
      puzzleId: p.id,
      diffIds: shuffle(p.diffIds).slice(0, DIFFS_PER_PUZZLE),
    }));
}

// Cron entry point. Idempotent — if today's row exists, do nothing. Builds
// for today AND tomorrow so a missed cron only matters if two consecutive
// days fail; the lazy fallback in `getDailyRound` covers that case anyway.
export async function buildDailySetForDate(env: Env, date: string): Promise<void> {
  const db = getDb(env.DB);
  const existing = await db
    .select({ date: dailyPuzzles.date })
    .from(dailyPuzzles)
    .where(eq(dailyPuzzles.date, date))
    .limit(1);
  if (existing.length > 0) return;

  const set = await pickDailySet(env);
  await db
    .insert(dailyPuzzles)
    .values({ date, puzzleSet: JSON.stringify(set) })
    .onConflictDoNothing();
}

// Read path used by request handlers. Loads the stored selection and
// re-hydrates RoundPuzzle[] from the current puzzles table. If no row exists
// (cron skip / first deploy), builds + persists on the spot so subsequent
// reads on the same day are stable.
export async function getDailyRound(env: Env, date: string): Promise<RoundPuzzle[]> {
  const db = getDb(env.DB);
  let row = await db
    .select({ puzzleSet: dailyPuzzles.puzzleSet })
    .from(dailyPuzzles)
    .where(eq(dailyPuzzles.date, date))
    .limit(1);

  if (row.length === 0) {
    await buildDailySetForDate(env, date);
    row = await db
      .select({ puzzleSet: dailyPuzzles.puzzleSet })
      .from(dailyPuzzles)
      .where(eq(dailyPuzzles.date, date))
      .limit(1);
    if (row.length === 0) throw new Error("daily: build_failed");
  }

  const stored = StoredDailySet.parse(JSON.parse(row[0]!.puzzleSet));
  // Pull every puzzle row once and build a lookup map. The pool is small
  // (hundreds, not millions) so a full scan beats N+1 single-row fetches.
  const puzzleRows = await db
    .select({
      id: puzzles.id,
      path: puzzles.path,
      extension: puzzles.extension,
      differences: puzzles.differences,
    })
    .from(puzzles);
  const byId = new Map(puzzleRows.map((p) => [p.id, p]));

  const round: RoundPuzzle[] = [];
  for (const s of stored) {
    const p = byId.get(s.puzzleId);
    if (!p) throw new Error(`daily: missing puzzle ${s.puzzleId}`);
    const allDiffs = StoredDifferences.parse(JSON.parse(p.differences));
    const wantIds = new Set(s.diffIds);
    const chosen = allDiffs.filter((d) => wantIds.has(d.id));
    if (chosen.length !== DIFFS_PER_PUZZLE) {
      throw new Error(`daily: diff drift on ${s.puzzleId}`);
    }
    const publicPuzzle: Puzzle = {
      id: p.id,
      path: p.path,
      extension: p.extension,
      differences: chosen,
    };
    round.push({
      puzzle: publicPuzzle,
      selectedDiffIds: s.diffIds,
      allDiffs,
    });
  }
  return round;
}
