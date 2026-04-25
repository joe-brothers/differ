import { Hono } from "hono";
import { asc, count, desc, eq, min } from "drizzle-orm";
import { LeaderboardQuery, type LeaderboardRes } from "@differ/shared";
import type { Env } from "../env.js";
import { getDb } from "../db/client.js";
import { gameResults, users } from "../db/schema.js";

export const leaderboardRoutes = new Hono<{ Bindings: Env }>();

// A row in `game_results` represents a win (losers are never inserted), so
// the leaderboard is a simple COUNT aggregation keyed by mode.
leaderboardRoutes.get("/", async (c) => {
  const parsed = LeaderboardQuery.safeParse({
    mode: c.req.query("mode"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  if (!parsed.success) {
    return c.json({ error: { code: "bad_request", message: parsed.error.message } }, 400);
  }
  const { mode, limit, offset } = parsed.data;

  const db = getDb(c.env.DB);
  const wins = count().as("wins");
  const bestMs = min(gameResults.elapsedMs).as("best_ms");

  // Single sprint is a time attack — rank by best completion time.
  // 1v1 is win-based — rank by wins, with best time as the tiebreaker.
  const orderBy = mode === "single" ? [asc(bestMs)] : [desc(wins), asc(bestMs)];

  const results = await db
    .select({
      userId: users.id,
      name: users.name,
      wins,
      bestMs,
    })
    .from(gameResults)
    .innerJoin(users, eq(users.id, gameResults.userId))
    .where(eq(gameResults.mode, mode))
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
