import { Hono } from "hono";
import { type AuthEnv } from "../auth/middleware.js";
import { readTokenCookie } from "../auth/cookie.js";
import { verifyToken } from "../auth/jwt.js";

export const matchmakingRoutes = new Hono<AuthEnv>();

// WebSocket upgrade for the random-match queue. Auth is performed here
// (cookie/header), then the verified token is forwarded to the singleton
// MatchmakingQueue DO via a private header.
matchmakingRoutes.get("/ws", async (c) => {
  const token = readTokenCookie(c) ?? c.req.header("Authorization")?.replace(/^Bearer /, "");
  if (!token) {
    return c.json({ error: { code: "unauthenticated", message: "Missing token" } }, 401);
  }
  const claims = await verifyToken(c.env.JWT_SECRET, token);
  if (!claims) {
    return c.json({ error: { code: "unauthenticated", message: "Invalid token" } }, 401);
  }
  const id = c.env.MATCHMAKING_QUEUE.idFromName("global");
  const stub = c.env.MATCHMAKING_QUEUE.get(id);
  const upgraded = new Request(c.req.raw, { headers: new Headers(c.req.raw.headers) });
  upgraded.headers.set("X-Auth-Token", token);
  return stub.fetch(upgraded);
});
