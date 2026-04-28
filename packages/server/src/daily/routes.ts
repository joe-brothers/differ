import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import type { Env } from "../env.js";
import { requireAuth, type AuthEnv } from "../auth/middleware.js";
import { getDb } from "../db/client.js";
import { dailyAttempts } from "../db/schema.js";
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
