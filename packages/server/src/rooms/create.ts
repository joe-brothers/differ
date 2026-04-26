import type { GameMode } from "@differ/shared";
import type { Env } from "../env.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1
const CODE_LENGTH = 6;

function genRoomCode(): string {
  // Rejection sampling: discard bytes in the tail that wouldn't divide
  // evenly across the alphabet, so each character has equal probability.
  // For the current 32-char alphabet this never rejects (256 % 32 === 0),
  // but the structure keeps it unbiased if the alphabet ever changes.
  const n = CODE_ALPHABET.length;
  const limit = 256 - (256 % n);
  let out = "";
  while (out.length < CODE_LENGTH) {
    const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
    for (const b of bytes) {
      if (b >= limit) continue;
      out += CODE_ALPHABET[b % n];
      if (out.length === CODE_LENGTH) break;
    }
  }
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
