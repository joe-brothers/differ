import { Hono } from "hono";
import { CreateRoomReq } from "@differ/shared";
import type { Env } from "../env.js";
import { requireAuth, type AuthEnv } from "../auth/middleware.js";

export const roomRoutes = new Hono<AuthEnv>();

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1
function genRoomCode(): string {
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (let i = 0; i < 6; i++) out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  return out;
}

// WebSocket upgrade — auth happens inside the DO via the `hello` message.
roomRoutes.get("/:code/ws", async (c) => {
  const code = c.req.param("code").toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    return c.json({ error: { code: "bad_code", message: "Invalid room code" } }, 400);
  }
  const id = c.env.GAME_ROOM.idFromName(code);
  const stub = c.env.GAME_ROOM.get(id);
  return stub.fetch(c.req.raw);
});

// Create room — requires auth.
roomRoutes.post("/", requireAuth, async (c) => {
  const raw = await c.req.json().catch(() => ({}));
  const parsed = CreateRoomReq.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: { code: "bad_request", message: "Invalid body" } }, 400);
  }
  const { mode } = parsed.data;
  const roomCode = genRoomCode();

  const id = (c.env as Env).GAME_ROOM.idFromName(roomCode);
  const stub = (c.env as Env).GAME_ROOM.get(id);

  const initRes = await stub.fetch("https://do/__init__", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ roomCode, mode, createdBy: c.get("user").sub }),
  });
  if (!initRes.ok) {
    const body = await initRes.text();
    return c.json({ error: { code: "init_failed", message: body } }, 500);
  }

  const host = new URL(c.req.url).host;
  const proto = c.req.url.startsWith("https") ? "wss" : "ws";
  return c.json({
    roomCode,
    wsUrl: `${proto}://${host}/rooms/${roomCode}/ws`,
  });
});
