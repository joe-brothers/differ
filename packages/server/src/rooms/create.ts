import type { GameMode } from "@differ/shared";
import type { Env } from "../env.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1
function genRoomCode(): string {
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (let i = 0; i < 6; i++) out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  return out;
}

// Allocates a new GameRoom DO and initializes it. Used by both the explicit
// `POST /rooms` flow and the matchmaking queue's auto-pairing path.
export async function createGameRoom(
  env: Env,
  mode: GameMode,
  createdBy: string,
): Promise<{ roomCode: string }> {
  const roomCode = genRoomCode();
  const id = env.GAME_ROOM.idFromName(roomCode);
  const stub = env.GAME_ROOM.get(id);
  const initRes = await stub.fetch("https://do/__init__", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ roomCode, mode, createdBy }),
  });
  if (!initRes.ok) {
    const body = await initRes.text();
    throw new Error(`init_failed: ${body}`);
  }
  return { roomCode };
}
