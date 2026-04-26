import { Hono } from "hono";
import { and, asc, count, desc, eq, gte, lt, min, type SQL } from "drizzle-orm";
import { LeaderboardQuery, type LeaderboardRes } from "@differ/shared";
import type { Env } from "../env.js";
import { getDb } from "../db/client.js";
import { gameParticipants, users } from "../db/schema.js";
import { utcDateKey } from "../daily/service.js";

export const leaderboardRoutes = new Hono<{ Bindings: Env }>();

// `game_participants` carries every player from every match. Filtering on
// outcome='win' isolates legitimate completions (timeout-winners are stored
// as 'timeout' so they don't earn leaderboard credit). For single/daily each
// participation is a 'win' on completion, so best_ms still ranks correctly.
//
// Daily uses a date-windowed query (UTC) so each calendar day has its own
// board. When `mode=daily` the request may pass `date=YYYY-MM-DD`; missing
// → today UTC.
leaderboardRoutes.get("/", async (c) => {
  const parsed = LeaderboardQuery.safeParse({
    mode: c.req.query("mode"),
    date: c.req.query("date"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  if (!parsed.success) {
    return c.json({ error: { code: "bad_request", message: parsed.error.message } }, 400);
  }
  const { mode, limit, offset } = parsed.data;
  const date = mode === "daily" ? (parsed.data.date ?? utcDateKey()) : null;

  const db = getDb(c.env.DB);
  const wins = count().as("wins");
  const bestMs = min(gameParticipants.elapsedMs).as("best_ms");

  // Single & daily are time-attacks — rank by best completion time.
  // 1v1 is win-based — rank by wins, with best time as the tiebreaker.
  const orderBy = mode === "1v1" ? [desc(wins), asc(bestMs)] : [asc(bestMs)];

  const filters: SQL[] = [
    eq(gameParticipants.mode, mode),
    eq(gameParticipants.outcome, "win"),
    eq(users.isGuest, 0),
  ];
  if (date) {
    // ended_at is stored as datetime('now') text — string-compare works
    // because the format is lexicographically ordered (YYYY-MM-DD HH:MM:SS).
    const startSql = `${date} 00:00:00`;
    const nextDate = utcDateKey(new Date(Date.parse(`${date}T00:00:00Z`) + 24 * 60 * 60 * 1000));
    const endSql = `${nextDate} 00:00:00`;
    filters.push(gte(gameParticipants.endedAt, startSql));
    filters.push(lt(gameParticipants.endedAt, endSql));
  }

  const results = await db
    .select({
      userId: users.id,
      name: users.name,
      wins,
      bestMs,
    })
    .from(gameParticipants)
    .innerJoin(users, eq(users.id, gameParticipants.userId))
    .where(and(...filters))
    .groupBy(users.id, users.name)
    .orderBy(...orderBy)
    .limit(limit)
    .offset(offset);

  const body: LeaderboardRes = {
    entries: results.map((r, i) => ({
      rank: offset + i + 1,
      userId: r.userId,
      name: r.name,
      wins: r.wins,
      bestMs: r.bestMs,
    })),
  };
  return c.json(body);
});
