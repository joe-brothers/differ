import { Hono } from "hono";
import { CreateRoomReq } from "@differ/shared";
import type { Env } from "../env.js";
import { requireAuth, type AuthEnv } from "../auth/middleware.js";
import { checkRateLimit, roomCreateKey } from "../auth/rate-limit.js";
import { readTokenCookie } from "../auth/cookie.js";
import { verifyToken } from "../auth/jwt.js";
import { createGameRoom } from "./create.js";

export const roomRoutes = new Hono<AuthEnv>();

// WebSocket upgrade. Auth is now done here at the worker level (cookie),
// then we forward the verified token to the DO via a private header so the
// DO can attach claims to the WebSocket on accept.
roomRoutes.get("/:code/ws", async (c) => {
  const code = c.req.param("code").toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    return c.json({ error: { code: "bad_code", message: "Invalid room code" } }, 400);
  }
  const token = readTokenCookie(c) ?? c.req.header("Authorization")?.replace(/^Bearer /, "");
  if (!token) {
    return c.json({ error: { code: "unauthenticated", message: "Missing token" } }, 401);
  }
  const claims = await verifyToken(c.env.JWT_SECRET, token);
  if (!claims) {
    return c.json({ error: { code: "unauthenticated", message: "Invalid token" } }, 401);
  }
  const id = c.env.GAME_ROOM.idFromName(code);
  const stub = c.env.GAME_ROOM.get(id);
  // Forward the verified token via a private header. The DO re-verifies
  // (defense in depth) before attaching the user to the WebSocket.
  const upgraded = new Request(c.req.raw, { headers: new Headers(c.req.raw.headers) });
  upgraded.headers.set("X-Auth-Token", token);
  return stub.fetch(upgraded);
});

// Create room — requires auth.
roomRoutes.post("/", requireAuth, async (c) => {
  const userId = c.get("user").sub;
  const limited = await checkRateLimit(c.env.RL_ROOM, roomCreateKey(userId));
  if (limited) return limited;

  const raw = await c.req.json().catch(() => ({}));
  const parsed = CreateRoomReq.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: { code: "bad_request", message: "Invalid body" } }, 400);
  }
  const { mode } = parsed.data;

  let roomCode: string;
  try {
    ({ roomCode } = await createGameRoom(c.env as Env, mode, userId));
  } catch (err) {
    return c.json({ error: { code: "init_failed", message: (err as Error).message } }, 500);
  }

  const host = new URL(c.req.url).host;
  const proto = c.req.url.startsWith("https") ? "wss" : "ws";
  return c.json({
    roomCode,
    wsUrl: `${proto}://${host}/rooms/${roomCode}/ws`,
  });
});
