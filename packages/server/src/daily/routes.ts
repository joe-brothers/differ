import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import type { Env } from "../env.js";
import { requireAuth, type AuthEnv } from "../auth/middleware.js";
import { getDb } from "../db/client.js";
import { dailyAttempts, gameParticipants, games, userStats } from "../db/schema.js";
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

// GET /daily/today — status for the daily card on the main menu.
//   - playable: no attempt yet today
//   - already-played: returns the prior result (elapsedMs, foundCount)
// Streak is included so the menu can render "Day N streak" without a
// second round trip.
dailyRoutes.get("/today", requireAuth, async (c) => {
  const userId = c.get("user").sub;
  const date = utcDateKey();
  const db = getDb(c.env.DB);

  const [attemptRow] = await db
    .select({ gameId: dailyAttempts.gameId })
    .from(dailyAttempts)
    .where(and(eq(dailyAttempts.userId, userId), eq(dailyAttempts.date, date)))
    .limit(1);

  const [statsRow] = await db
    .select({
      current: userStats.currentStreak,
      longest: userStats.longestStreak,
      last: userStats.lastDailyDate,
    })
    .from(userStats)
    .where(eq(userStats.userId, userId))
    .limit(1);

  let result: {
    elapsedMs: number | null;
    foundCount: number;
    outcome: string;
  } | null = null;
  if (attemptRow) {
    const [participant] = await db
      .select({
        elapsedMs: gameParticipants.elapsedMs,
        foundCount: gameParticipants.foundCount,
        outcome: gameParticipants.outcome,
      })
      .from(gameParticipants)
      .where(
        and(eq(gameParticipants.gameId, attemptRow.gameId), eq(gameParticipants.userId, userId)),
      )
      .limit(1);
    if (participant) {
      result = participant;
    } else {
      // Guest path — daily_attempts exists, gameParticipants doesn't (D4).
      // Fall back to the games row so the share card still renders something.
      const [game] = await db
        .select({ endReason: games.endReason })
        .from(games)
        .where(eq(games.id, attemptRow.gameId))
        .limit(1);
      result = {
        elapsedMs: null,
        foundCount: 0,
        outcome: game?.endReason === "winner" ? "win" : "timeout",
      };
    }
  }

  return c.json({
    date,
    played: !!attemptRow,
    result,
    streak: {
      current: statsRow?.current ?? 0,
      longest: statsRow?.longest ?? 0,
      lastDailyDate: statsRow?.last ?? null,
    },
  });
});

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
