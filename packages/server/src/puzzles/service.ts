import { z } from 'zod';
import {
  Puzzle, RectArea,
  PUZZLES_PER_GAME, DIFFS_PER_PUZZLE, PUZZLE_CANDIDATE_COUNT,
} from '@differ/shared';
import type { Env } from '../env.js';

const StoredDifferences = z.array(RectArea);

// Fully-loaded puzzle including all diffs (server-side authority).
export interface LoadedPuzzle {
  id: string;
  path: string;
  extension: string;
  allDiffs: RectArea[];
}

// Per-round selection: 5 puzzles × 5 chosen diffs each.
export interface RoundPuzzle {
  puzzle: Puzzle;                    // public view (only selected diffs)
  selectedDiffIds: string[];         // stable ordering
  allDiffs: RectArea[];              // server authority for click validation
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

async function loadCandidates(db: D1Database): Promise<LoadedPuzzle[]> {
  const { results } = await db.prepare(
    `SELECT id, differences, path, extension FROM puzzles ORDER BY RANDOM() LIMIT ?`,
  ).bind(PUZZLE_CANDIDATE_COUNT).all<{
    id: string; differences: string; path: string; extension: string;
  }>();

  const loaded: LoadedPuzzle[] = [];
  for (const row of results) {
    const parsed = StoredDifferences.safeParse(JSON.parse(row.differences));
    if (!parsed.success) continue;
    loaded.push({
      id: row.id,
      path: row.path,
      extension: row.extension,
      allDiffs: parsed.data,
    });
  }
  return loaded;
}

export async function buildRound(env: Env): Promise<RoundPuzzle[]> {
  const candidates = await loadCandidates(env.DB);
  if (candidates.length < PUZZLES_PER_GAME) {
    throw new Error(`Not enough puzzles (have ${candidates.length}, need ${PUZZLES_PER_GAME})`);
  }

  const picked = shuffle(candidates).slice(0, PUZZLES_PER_GAME);
  return picked.map<RoundPuzzle>((p) => {
    const eligible = p.allDiffs.filter((d) => d.w > 0 && d.h > 0);
    const chosen = shuffle(eligible).slice(0, Math.min(DIFFS_PER_PUZZLE, eligible.length));
    const publicPuzzle: Puzzle = {
      id: p.id,
      path: p.path,
      extension: p.extension,
      differences: chosen,
    };
    return {
      puzzle: publicPuzzle,
      selectedDiffIds: chosen.map((d) => d.id),
      allDiffs: p.allDiffs,
    };
  });
}

export function hitTest(area: RectArea, x: number, y: number): boolean {
  return x >= area.sp.x && x <= area.sp.x + area.w && y >= area.sp.y && y <= area.sp.y + area.h;
}

// Given a click, return the selected diff that was hit, or null.
export function findHit(round: RoundPuzzle, x: number, y: number): RectArea | null {
  for (const d of round.puzzle.differences) {
    if (hitTest(d, x, y)) return d;
  }
  return null;
}
