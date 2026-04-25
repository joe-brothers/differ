import {
  ClientMsg,
  ServerMsg,
  type GameMode,
  type Puzzle,
  PUZZLES_PER_GAME,
  DIFFS_PER_PUZZLE,
} from "@differ/shared";
import type { Env } from "../env.js";
import { verifyToken } from "../auth/jwt.js";
import { getDb } from "../db/client.js";
import { gameResults } from "../db/schema.js";
import { buildRound, findHit, type RoundPuzzle } from "../puzzles/service.js";

type RoomStatus = "waiting" | "in_progress" | "ended";

interface StoredPlayer {
  userId: string;
  name: string;
  ready: boolean;
  foundPerPuzzle: Record<number, string[]>; // puzzleIdx -> diffIds
  elapsedMs: number | null;
}

interface StoredRoom {
  code: string;
  mode: GameMode;
  status: RoomStatus;
  players: Record<string, StoredPlayer>; // keyed by userId
  puzzles: RoundPuzzle[] | null; // null until game_start
  startedAt: number | null;
  createdAt: number;
  winnerId: string | null;
  gamesPlayed: number; // 0 = first game (auto-start); >0 = rematch (both must ready)
}

interface SocketAttachment {
  userId: string;
  name: string;
}

const ROOM_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 min
const GAME_TIMEOUT_MS = 10 * 60 * 1000; // 10 min hard cap
// Delay between game_start broadcast and actual play start, to cover
// per-client image loading + countdown so both clients begin at the same
// wall-clock moment. The client counts down to `startedAt`.
const START_COUNTDOWN_MS = 3500;

export class GameRoom implements DurableObject {
  private room: StoredRoom | null = null;

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<StoredRoom>("room");
      if (stored) this.room = stored;
    });
  }

  // ─── HTTP/WS entry ───────────────────────────────────────────────────────

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/__init__" && req.method === "POST") {
      const body = await req.json<{ roomCode: string; mode: GameMode; createdBy: string }>();
      return this.initRoom(body.roomCode, body.mode);
    }

    const upgrade = req.headers.get("Upgrade");
    if (upgrade?.toLowerCase() === "websocket") {
      if (!this.room) return new Response("Room not initialized", { status: 404 });
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];
      this.state.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not Found", { status: 404 });
  }

  // ─── Hibernatable WS callbacks ───────────────────────────────────────────

  async webSocketMessage(ws: WebSocket, data: ArrayBuffer | string): Promise<void> {
    if (!this.room) {
      this.sendError(ws, "no_room", "Room no longer exists");
      ws.close(1011, "no_room");
      return;
    }
    let parsed;
    try {
      const json = typeof data === "string" ? data : new TextDecoder().decode(data);
      parsed = ClientMsg.safeParse(JSON.parse(json));
    } catch {
      this.sendError(ws, "bad_json", "Malformed message");
      return;
    }
    if (!parsed.success) {
      this.sendError(ws, "bad_msg", parsed.error.message);
      return;
    }
    const msg = parsed.data;

    const attachment = ws.deserializeAttachment() as SocketAttachment | null;

    if (msg.kind === "hello") {
      await this.handleHello(ws, msg.token);
      return;
    }

    if (!attachment) {
      this.sendError(ws, "no_hello", "Send hello first");
      ws.close(1008, "no_hello");
      return;
    }

    switch (msg.kind) {
      case "ready":
        await this.handleReady(attachment.userId);
        break;
      case "click":
        await this.handleClick(attachment.userId, msg.puzzleIdx, msg.x, msg.y);
        break;
      case "leave":
        this.broadcast({ kind: "player_left", userId: attachment.userId });
        ws.close(1000, "leave");
        break;
    }
  }

  async webSocketClose(
    ws: WebSocket,
    _code: number,
    _reason: string,
    _clean: boolean,
  ): Promise<void> {
    if (!this.room) return;
    const attachment = ws.deserializeAttachment() as SocketAttachment | null;
    if (!attachment) return;
    const { userId } = attachment;

    // If another active socket still belongs to this user, treat as a
    // replacement (see reconnect path in handleHello) — no state change.
    for (const other of this.state.getWebSockets()) {
      if (other === ws) continue;
      const a = other.deserializeAttachment() as SocketAttachment | null;
      if (a?.userId === userId) return;
    }

    if (this.room.status === "in_progress") {
      // Soft disconnect; keep the seat for reconnection.
      this.broadcast({ kind: "player_offline", userId });
      return;
    }

    // Waiting state (pre-first-game OR post-game): the seat is given up.
    if (!this.room.players[userId]) return;
    delete this.room.players[userId];
    this.broadcast({ kind: "player_left", userId });

    if (Object.keys(this.room.players).length === 0) {
      await this.state.storage.deleteAll();
      this.room = null;
      return;
    }

    // When a player bails during the post-game rematch vote, reset the
    // room to a fresh-first-game state for whoever remains. That way a
    // brand-new joiner triggers auto-start rather than being blocked by
    // the remaining player's stale ready flag.
    for (const p of Object.values(this.room.players)) p.ready = false;
    this.room.gamesPlayed = 0;
    await this.persist();
  }

  async webSocketError(_ws: WebSocket, _err: unknown): Promise<void> {
    // noop
  }

  async alarm(): Promise<void> {
    if (!this.room) return;
    const now = Date.now();

    // Hard game timeout.
    if (
      this.room.status === "in_progress" &&
      this.room.startedAt &&
      now - this.room.startedAt >= GAME_TIMEOUT_MS
    ) {
      await this.endGame(null, "timeout");
      await this.scheduleIdleCleanup();
      return;
    }

    // Idle cleanup.
    const lastActivity = this.room.startedAt ?? this.room.createdAt;
    if (now - lastActivity >= ROOM_IDLE_TIMEOUT_MS) {
      await this.state.storage.deleteAll();
      this.room = null;
    }
  }

  // ─── Handlers ────────────────────────────────────────────────────────────

  private async initRoom(code: string, mode: GameMode): Promise<Response> {
    if (this.room) {
      return new Response(JSON.stringify({ ok: true, already: true }), {
        headers: { "content-type": "application/json" },
      });
    }
    this.room = {
      code,
      mode,
      status: "waiting",
      players: {},
      puzzles: null,
      startedAt: null,
      createdAt: Date.now(),
      winnerId: null,
      gamesPlayed: 0,
    };
    await this.persist();
    await this.state.storage.setAlarm(Date.now() + ROOM_IDLE_TIMEOUT_MS);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
  }

  private async handleHello(ws: WebSocket, token: string): Promise<void> {
    const claims = await verifyToken(this.env.JWT_SECRET, token);
    if (!claims) {
      this.sendError(ws, "unauthenticated", "Invalid token");
      ws.close(1008, "unauthenticated");
      return;
    }
    if (!this.room) {
      this.sendError(ws, "no_room", "Room missing");
      ws.close(1011);
      return;
    }

    const capacity = this.room.mode === "single" ? 1 : 2;
    const existing = this.room.players[claims.sub];
    if (!existing) {
      if (Object.keys(this.room.players).length >= capacity) {
        this.sendError(ws, "room_full", "Room full");
        ws.close(1008, "room_full");
        return;
      }
      if (this.room.status !== "waiting") {
        this.sendError(ws, "in_progress", "Game already in progress");
        ws.close(1008, "in_progress");
        return;
      }
      this.room.players[claims.sub] = {
        userId: claims.sub,
        name: claims.name,
        ready: false,
        foundPerPuzzle: {},
        elapsedMs: null,
      };
    }

    // Close any prior socket belonging to this user (reconnect case).
    for (const other of this.state.getWebSockets()) {
      if (other === ws) continue;
      const a = other.deserializeAttachment() as SocketAttachment | null;
      if (a?.userId === claims.sub) {
        try {
          other.close(4001, "replaced");
        } catch {
          /* ignore */
        }
      }
    }

    ws.serializeAttachment({ userId: claims.sub, name: claims.name });

    if (!existing) {
      // Brand new seat.
      this.broadcastExcept(claims.sub, {
        kind: "player_joined",
        player: { userId: claims.sub, name: claims.name, ready: false, online: true },
      });
    } else if (this.room.status === "in_progress") {
      // Reconnect during an active game.
      this.broadcastExcept(claims.sub, { kind: "player_online", userId: claims.sub });
    }

    this.send(ws, this.buildWelcome(claims.sub));
    await this.persist();

    // Auto-start the FIRST game as soon as the room fills. Rematches still
    // require explicit `ready` from both players (see handleReady).
    if (
      this.room.status === "waiting" &&
      this.room.gamesPlayed === 0 &&
      Object.keys(this.room.players).length >= capacity
    ) {
      await this.startGame();
    }
  }

  private async handleReady(userId: string): Promise<void> {
    if (!this.room || this.room.status !== "waiting") return;
    // First game auto-starts on fill; ready is only used for rematch votes.
    if (this.room.gamesPlayed === 0) return;
    const player = this.room.players[userId];
    if (!player || player.ready) return;
    player.ready = true;
    this.broadcast({ kind: "player_ready", userId });

    const capacity = this.room.mode === "single" ? 1 : 2;
    const playerList = Object.values(this.room.players);
    if (playerList.length >= capacity && playerList.every((p) => p.ready)) {
      await this.startGame();
    } else {
      await this.persist();
    }
  }

  private async startGame(): Promise<void> {
    if (!this.room) return;
    const puzzles = await buildRound(this.env);
    this.room.puzzles = puzzles;
    this.room.status = "in_progress";
    // Future-dated so both clients can cover image loading + countdown and
    // then begin counting from the exact same wall-clock instant.
    this.room.startedAt = Date.now() + START_COUNTDOWN_MS;

    this.broadcast({
      kind: "game_start",
      startedAt: this.room.startedAt,
      puzzles: puzzles.map((p) => p.puzzle),
    });
    await this.state.storage.setAlarm(this.room.startedAt + GAME_TIMEOUT_MS);
    await this.persist();
  }

  private async handleClick(
    userId: string,
    puzzleIdx: number,
    x: number,
    y: number,
  ): Promise<void> {
    if (!this.room || this.room.status !== "in_progress" || !this.room.puzzles) return;
    // Reject clicks made during the pre-start countdown window.
    if (this.room.startedAt && Date.now() < this.room.startedAt) return;
    const player = this.room.players[userId];
    if (!player || player.elapsedMs !== null) return;

    const round = this.room.puzzles[puzzleIdx];
    if (!round) return;

    const hitArea = findHit(round, x, y);

    let diffId: string | undefined;
    let hit = false;
    if (hitArea) {
      const already = player.foundPerPuzzle[puzzleIdx] ?? [];
      if (!already.includes(hitArea.id)) {
        already.push(hitArea.id);
        player.foundPerPuzzle[puzzleIdx] = already;
        hit = true;
        diffId = hitArea.id;
      }
    }

    const foundCount = totalFound(player);

    this.broadcast({
      kind: "click_result",
      userId,
      puzzleIdx,
      hit,
      diffId,
      foundCount,
    });

    const target = PUZZLES_PER_GAME * DIFFS_PER_PUZZLE;
    if (foundCount >= target) {
      player.elapsedMs = this.room.startedAt ? Date.now() - this.room.startedAt : 0;
      await this.endGame(userId, "winner");
      return;
    }

    await this.persist();
  }

  private async endGame(winnerId: string | null, _reason: string): Promise<void> {
    if (!this.room) return;
    this.room.status = "ended";
    this.room.winnerId = winnerId;

    // Persist game results to D1 for everyone with a complete run.
    const rows: Array<typeof gameResults.$inferInsert> = [];
    for (const p of Object.values(this.room.players)) {
      if (p.elapsedMs == null && p.userId === winnerId && this.room.startedAt) {
        p.elapsedMs = Date.now() - this.room.startedAt;
      }
      if (p.elapsedMs != null) {
        rows.push({
          id: crypto.randomUUID(),
          userId: p.userId,
          roomCode: this.room.code,
          mode: this.room.mode,
          elapsedMs: p.elapsedMs,
        });
      }
    }
    if (rows.length > 0) {
      await getDb(this.env.DB).insert(gameResults).values(rows).run();
    }

    // Report every player's elapsed time in the broadcast so losers can show
    // how long the game lasted, not 00:00. Losers (and timeouts) never had
    // their own elapsedMs set — fall back to game-end-minus-start.
    const gameElapsedMs = this.room.startedAt ? Date.now() - this.room.startedAt : null;
    this.broadcast({
      kind: "game_end",
      winnerId,
      results: Object.values(this.room.players).map((p) => ({
        userId: p.userId,
        name: p.name,
        elapsedMs: p.elapsedMs ?? gameElapsedMs,
        foundCount: totalFound(p),
      })),
    });

    // Reset state so the room can host a rematch. Both players must send
    // `ready` before the next game starts.
    for (const p of Object.values(this.room.players)) {
      p.ready = false;
      p.foundPerPuzzle = {};
      p.elapsedMs = null;
    }
    this.room.status = "waiting";
    this.room.puzzles = null;
    this.room.startedAt = null;
    this.room.winnerId = null;
    this.room.gamesPlayed += 1;

    await this.persist();
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private onlineUserIds(): Set<string> {
    const ids = new Set<string>();
    for (const ws of this.state.getWebSockets()) {
      const a = ws.deserializeAttachment() as SocketAttachment | null;
      if (a?.userId) ids.add(a.userId);
    }
    return ids;
  }

  private buildWelcome(forUserId: string): ServerMsg {
    if (!this.room) throw new Error("no room");
    const you = this.room.players[forUserId]!;
    const online = this.onlineUserIds();
    const players = Object.values(this.room.players).map((p) => ({
      userId: p.userId,
      name: p.name,
      ready: p.ready,
      online: online.has(p.userId),
      isYou: p.userId === forUserId,
    }));
    const puzzles: Puzzle[] | undefined = this.room.puzzles?.map((r) => r.puzzle);
    const yourFound = Object.entries(you.foundPerPuzzle).map(([idx, diffIds]) => ({
      puzzleIdx: Number(idx),
      diffIds,
    }));
    const progress = Object.values(this.room.players).map((p) => ({
      userId: p.userId,
      foundCount: totalFound(p),
    }));
    return {
      kind: "welcome",
      roomCode: this.room.code,
      mode: this.room.mode,
      status: this.room.status,
      you: { userId: you.userId, name: you.name },
      players,
      puzzles,
      startedAt: this.room.startedAt ?? undefined,
      yourFound: yourFound.length > 0 ? yourFound : undefined,
      progress: progress.length > 0 ? progress : undefined,
    };
  }

  private send(ws: WebSocket, msg: ServerMsg): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* socket gone */
    }
  }

  private sendError(ws: WebSocket, code: string, message: string): void {
    this.send(ws, { kind: "error", code, message });
  }

  private broadcast(msg: ServerMsg): void {
    for (const ws of this.state.getWebSockets()) this.send(ws, msg);
  }

  private broadcastExcept(userId: string, msg: ServerMsg): void {
    for (const ws of this.state.getWebSockets()) {
      const a = ws.deserializeAttachment() as SocketAttachment | null;
      if (a?.userId === userId) continue;
      this.send(ws, msg);
    }
  }

  private async persist(): Promise<void> {
    if (this.room) await this.state.storage.put("room", this.room);
  }

  private async scheduleIdleCleanup(): Promise<void> {
    await this.state.storage.setAlarm(Date.now() + ROOM_IDLE_TIMEOUT_MS);
  }
}

function totalFound(p: StoredPlayer): number {
  let n = 0;
  for (const ids of Object.values(p.foundPerPuzzle)) n += ids.length;
  return n;
}
