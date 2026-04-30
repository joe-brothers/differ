import { Hono } from "hono";
import { and, asc, eq, gte, lt, min } from "drizzle-orm";
import { DailySummaryQuery, type DailySummaryRes, type PercentileBucket } from "@differ/shared";
import type { Env } from "../env.js";
import { requireAuth, type AuthEnv } from "../auth/middleware.js";
import { getDb } from "../db/client.js";
import { dailyAttempts, gameParticipants, users } from "../db/schema.js";
import { createGameRoom } from "../rooms/create.js";
import { utcDateKey } from "./service.js";

export const dailyRoutes = new Hono<AuthEnv>();

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // matches genRoomCode

// Deterministic 6-char room code derived from (date, userId). Same shape as
// random codes (passes the WS upgrade regex `/^[A-Z0-9]{6}$/`) so the same
// `/rooms/:code/ws` endpoint serves the daily flow.
async function dailyRoomCode(date: string, userId: string): Promise<string> {
  const data = new TextEncoder().encode(`daily:${date}:${userId}`);
  const buf = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  let out = "";
  let i = 0;
  while (out.length < 6 && i < buf.length) {
    out += CODE_ALPHABET[buf[i]! % CODE_ALPHABET.length];
    i++;
  }
  return out;
}

// POST /daily/start — start (or resume) today's daily attempt.
//   - if already played today: 409 daily_already_played
//   - else: ensures a deterministic-coded GameRoom DO exists and returns the
//     ws URL. The DO is idempotent on __init__, so a refresh re-uses it.
dailyRoutes.post("/start", requireAuth, async (c) => {
  const userId = c.get("user").sub;
  const date = utcDateKey();
  const db = getDb(c.env.DB);

  const existing = await db
    .select({ gameId: dailyAttempts.gameId })
    .from(dailyAttempts)
    .where(and(eq(dailyAttempts.userId, userId), eq(dailyAttempts.date, date)))
    .limit(1);
  if (existing.length > 0) {
    return c.json(
      {
        error: {
          code: "daily_already_played",
          message: "You already played today's daily.",
        },
      },
      409,
    );
  }

  const roomCode = await dailyRoomCode(date, userId);
  try {
    await createGameRoom(c.env as Env, "daily", userId, { roomCode, dailyDate: date });
  } catch (err) {
    return c.json({ error: { code: "init_failed", message: (err as Error).message } }, 500);
  }

  const host = new URL(c.req.url).host;
  const proto = c.req.url.startsWith("https") ? "wss" : "ws";
  return c.json({
    roomCode,
    wsUrl: `${proto}://${host}/rooms/${roomCode}/ws`,
    date,
  });
});

// Smallest LinkedIn-style bucket the user fits, gated by sample size so a
// "top 1%" badge can never appear with only a handful of players. Returns null
// for rank=null (ineligible) or when no bucket's N threshold is met.
function computeBucket(rank: number | null, total: number): PercentileBucket | null {
  if (rank == null || total < 2) return null;
  const pct = (rank - 1) / total;
  if (pct < 0.01 && total >= 100) return "top1";
  if (pct < 0.05 && total >= 20) return "top5";
  if (pct < 0.1 && total >= 10) return "top10";
  if (pct < 0.25 && total >= 4) return "top25";
  if (pct < 0.5) return "top50";
  return null;
}

// GET /daily/summary?date=YYYY-MM-DD — rank vs the day's leader + percentile
// bucket for the result screen. Same eligibility as `/leaderboard?mode=daily`
// (win + no hints + non-guest); a hint-assisted or timed-out user gets
// yourMs=null, yourRank=null and only sees totals/leaderMs.
dailyRoutes.get("/summary", requireAuth, async (c) => {
  const parsed = DailySummaryQuery.safeParse({ date: c.req.query("date") });
  if (!parsed.success) {
    return c.json({ error: { code: "bad_request", message: parsed.error.message } }, 400);
  }
  const { date } = parsed.data;
  const userId = c.get("user").sub;
  const db = getDb(c.env.DB);

  const startSql = `${date} 00:00:00`;
  const nextDate = utcDateKey(new Date(Date.parse(`${date}T00:00:00Z`) + 24 * 60 * 60 * 1000));
  const endSql = `${nextDate} 00:00:00`;

  // One pass over the day's qualifying participants. Daily counts are bounded
  // (one row per user per day max), so loading them all and computing in JS is
  // simpler and cheaper than three round trips for total/leader/rank.
  const bestMs = min(gameParticipants.elapsedMs).as("best_ms");
  const rows = await db
    .select({ userId: users.id, bestMs })
    .from(gameParticipants)
    .innerJoin(users, eq(users.id, gameParticipants.userId))
    .where(
      and(
        eq(gameParticipants.mode, "daily"),
        eq(gameParticipants.outcome, "win"),
        eq(gameParticipants.hintsUsed, 0),
        eq(users.isGuest, 0),
        gte(gameParticipants.endedAt, startSql),
        lt(gameParticipants.endedAt, endSql),
      ),
    )
    .groupBy(users.id)
    .orderBy(asc(bestMs));

  const totalPlayers = rows.length;
  const leaderMs = rows[0]?.bestMs ?? null;
  const me = rows.find((r) => r.userId === userId);
  const yourMs = me?.bestMs ?? null;
  // Standard ranking: count of strictly faster players + 1. Ties share the
  // higher (better) rank. With ms precision actual ties are vanishingly rare.
  const yourRank =
    yourMs == null ? null : rows.findIndex((r) => (r.bestMs ?? Infinity) >= yourMs) + 1;

  const body: DailySummaryRes = {
    date,
    totalPlayers,
    leaderMs,
    yourMs,
    yourRank,
    bucket: computeBucket(yourRank, totalPlayers),
  };
  return c.json(body);
});
