import { z } from "zod";
import { Puzzle, GameMode } from "./game.js";

// ─── Client → Server ────────────────────────────────────────────────────────

// Auth is performed at the WebSocket upgrade (cookie/header). `hello` is a
// pure handshake — it tells the server "I'm ready, send me the welcome".
export const ClientHello = z.object({
  kind: z.literal("hello"),
});
export type ClientHello = z.infer<typeof ClientHello>;

export const ClientReady = z.object({
  kind: z.literal("ready"),
});
export type ClientReady = z.infer<typeof ClientReady>;

export const ClientClick = z.object({
  kind: z.literal("click"),
  puzzleIdx: z.number().int().min(0),
  x: z.number(),
  y: z.number(),
});
export type ClientClick = z.infer<typeof ClientClick>;

export const ClientLeave = z.object({
  kind: z.literal("leave"),
});
export type ClientLeave = z.infer<typeof ClientLeave>;

export const ClientMsg = z.discriminatedUnion("kind", [
  ClientHello,
  ClientReady,
  ClientClick,
  ClientLeave,
]);
export type ClientMsg = z.infer<typeof ClientMsg>;

// ─── Server → Client ────────────────────────────────────────────────────────

export const RoomPlayer = z.object({
  userId: z.string(),
  name: z.string(),
  ready: z.boolean(),
  online: z.boolean(),
  isYou: z.boolean().optional(),
  // 1v1 wins to date for this user. Shown next to the opponent's name in
  // the lobby/HUD so people get a feel for who they're playing.
  wins: z.number().int().min(0).default(0),
});
export type RoomPlayer = z.infer<typeof RoomPlayer>;

export const PlayerProgress = z.object({
  userId: z.string(),
  foundCount: z.number(),
});
export type PlayerProgress = z.infer<typeof PlayerProgress>;

// Initial state after a successful `hello`. Includes enough context to render
// the current room state even when rejoining mid-game.
export const ServerWelcome = z.object({
  kind: z.literal("welcome"),
  roomCode: z.string(),
  mode: GameMode,
  status: z.enum(["waiting", "in_progress", "ended"]),
  you: z.object({ userId: z.string(), name: z.string() }),
  players: z.array(RoomPlayer),
  puzzles: z.array(Puzzle).optional(), // present once game has started
  startedAt: z.number().optional(),
  yourFound: z
    .array(
      z.object({
        puzzleIdx: z.number(),
        diffIds: z.array(z.string()),
      }),
    )
    .optional(),
  progress: z.array(PlayerProgress).optional(),
});
export type ServerWelcome = z.infer<typeof ServerWelcome>;

export const ServerPlayerJoined = z.object({
  kind: z.literal("player_joined"),
  player: RoomPlayer,
});
export type ServerPlayerJoined = z.infer<typeof ServerPlayerJoined>;

export const ServerPlayerLeft = z.object({
  kind: z.literal("player_left"),
  userId: z.string(),
});
export type ServerPlayerLeft = z.infer<typeof ServerPlayerLeft>;

export const ServerPlayerOffline = z.object({
  kind: z.literal("player_offline"),
  userId: z.string(),
});
export type ServerPlayerOffline = z.infer<typeof ServerPlayerOffline>;

export const ServerPlayerOnline = z.object({
  kind: z.literal("player_online"),
  userId: z.string(),
});
export type ServerPlayerOnline = z.infer<typeof ServerPlayerOnline>;

export const ServerPlayerReady = z.object({
  kind: z.literal("player_ready"),
  userId: z.string(),
});
export type ServerPlayerReady = z.infer<typeof ServerPlayerReady>;

export const ServerGameStart = z.object({
  kind: z.literal("game_start"),
  startedAt: z.number(),
  puzzles: z.array(Puzzle),
});
export type ServerGameStart = z.infer<typeof ServerGameStart>;

export const ServerClickResult = z.object({
  kind: z.literal("click_result"),
  userId: z.string(),
  puzzleIdx: z.number(),
  hit: z.boolean(),
  diffId: z.string().optional(),
  foundCount: z.number(),
});
export type ServerClickResult = z.infer<typeof ServerClickResult>;

export const ServerGameEnd = z.object({
  kind: z.literal("game_end"),
  winnerId: z.string().nullable(),
  results: z.array(
    z.object({
      userId: z.string(),
      name: z.string(),
      elapsedMs: z.number().nullable(),
      foundCount: z.number(),
    }),
  ),
});
export type ServerGameEnd = z.infer<typeof ServerGameEnd>;

export const ServerError = z.object({
  kind: z.literal("error"),
  code: z.string(),
  message: z.string(),
});
export type ServerError = z.infer<typeof ServerError>;

export const ServerMsg = z.discriminatedUnion("kind", [
  ServerWelcome,
  ServerPlayerJoined,
  ServerPlayerLeft,
  ServerPlayerOffline,
  ServerPlayerOnline,
  ServerPlayerReady,
  ServerGameStart,
  ServerClickResult,
  ServerGameEnd,
  ServerError,
]);
export type ServerMsg = z.infer<typeof ServerMsg>;

// ─── Matchmaking queue (random 1v1) ─────────────────────────────────────────
// Separate channel from GameRoom WS. Client connects, sends `queue_join`,
// waits for `queue_matched` with a room code, then closes the queue WS and
// connects to the regular GameRoom WS at that code.

export const QueueClientJoin = z.object({
  kind: z.literal("queue_join"),
  // The userId of the client's most recent 1v1 opponent. Used to avoid
  // pairing the same two players back-to-back, with a 5s relaxation window.
  lastOpponentId: z.string().nullable(),
});
export type QueueClientJoin = z.infer<typeof QueueClientJoin>;

export const QueueClientCancel = z.object({
  kind: z.literal("queue_cancel"),
});
export type QueueClientCancel = z.infer<typeof QueueClientCancel>;

export const QueueClientMsg = z.discriminatedUnion("kind", [QueueClientJoin, QueueClientCancel]);
export type QueueClientMsg = z.infer<typeof QueueClientMsg>;

export const QueueServerQueued = z.object({
  kind: z.literal("queue_queued"),
});
export type QueueServerQueued = z.infer<typeof QueueServerQueued>;

export const QueueServerMatched = z.object({
  kind: z.literal("queue_matched"),
  roomCode: z.string(),
});
export type QueueServerMatched = z.infer<typeof QueueServerMatched>;

export const QueueServerError = z.object({
  kind: z.literal("queue_error"),
  code: z.string(),
  message: z.string(),
});
export type QueueServerError = z.infer<typeof QueueServerError>;

export const QueueServerMsg = z.discriminatedUnion("kind", [
  QueueServerQueued,
  QueueServerMatched,
  QueueServerError,
]);
export type QueueServerMsg = z.infer<typeof QueueServerMsg>;
