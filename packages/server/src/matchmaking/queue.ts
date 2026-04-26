import { QueueClientMsg, type QueueServerMsg } from "@differ/shared";
import type { Env } from "../env.js";
import { verifyToken } from "../auth/jwt.js";
import { createGameRoom } from "../rooms/create.js";

// Singleton DO holding the global 1v1 random-match queue. Hibernatable WS
// keeps memory cheap; per-socket attachment carries the waiter state so we
// don't need separate storage. FCFS pairing with a "don't rematch the same
// pair within 5 seconds" rule (relaxes after 5s so two-person queues unblock).

const REMATCH_GUARD_MS = 5000;
const MAX_WS_MESSAGE_BYTES = 4 * 1024;

interface QueueAttachment {
  userId: string;
  name: string;
  // Set on `queue_join`. Until then the socket is connected but not in line.
  joined: boolean;
  joinedAt: number;
  lastOpponentId: string | null;
}

export class MatchmakingQueue implements DurableObject {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(req: Request): Promise<Response> {
    const upgrade = req.headers.get("Upgrade");
    if (upgrade?.toLowerCase() !== "websocket") {
      return new Response("Not Found", { status: 404 });
    }
    // Worker layer already verified the cookie/token; we re-verify (defense
    // in depth) and stash claims on the socket.
    const token = req.headers.get("X-Auth-Token");
    if (!token) return new Response("Unauthenticated", { status: 401 });
    const claims = await verifyToken(this.env.JWT_SECRET, token);
    if (!claims) return new Response("Invalid token", { status: 401 });

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.state.acceptWebSocket(server);
    server.serializeAttachment({
      userId: claims.sub,
      name: claims.name,
      joined: false,
      joinedAt: 0,
      lastOpponentId: null,
    } satisfies QueueAttachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, data: ArrayBuffer | string): Promise<void> {
    const size = typeof data === "string" ? data.length : data.byteLength;
    if (size > MAX_WS_MESSAGE_BYTES) {
      ws.close(1009, "too_large");
      return;
    }
    let parsed;
    try {
      const json = typeof data === "string" ? data : new TextDecoder().decode(data);
      parsed = QueueClientMsg.safeParse(JSON.parse(json));
    } catch {
      this.sendError(ws, "bad_json", "Malformed message");
      return;
    }
    if (!parsed.success) {
      this.sendError(ws, "bad_msg", parsed.error.message);
      return;
    }
    const msg = parsed.data;
    const attachment = ws.deserializeAttachment() as QueueAttachment | null;
    if (!attachment) {
      ws.close(1008, "unauthenticated");
      return;
    }

    if (msg.kind === "queue_cancel") {
      ws.close(1000, "cancel");
      return;
    }

    // queue_join — mark this socket as queued and run a matching sweep.
    if (attachment.joined) return; // double-join, ignore
    // If the same user has another queued socket (multi-tab), close the old
    // one — only the latest tab is in line.
    for (const other of this.state.getWebSockets()) {
      if (other === ws) continue;
      const a = other.deserializeAttachment() as QueueAttachment | null;
      if (a?.userId === attachment.userId) {
        try {
          other.close(4001, "replaced");
        } catch {
          /* ignore */
        }
      }
    }

    const updated: QueueAttachment = {
      ...attachment,
      joined: true,
      joinedAt: Date.now(),
      lastOpponentId: msg.lastOpponentId,
    };
    ws.serializeAttachment(updated);
    this.send(ws, { kind: "queue_queued" });
    await this.matchSweep();
  }

  async webSocketClose(_ws: WebSocket): Promise<void> {
    // The closed socket is gone from getWebSockets() by the time this fires.
    // Re-arm the alarm in case its absence changes which pair unblocks first.
    await this.scheduleUnblockAlarm();
  }

  async webSocketError(): Promise<void> {
    /* noop */
  }

  async alarm(): Promise<void> {
    // Fires when a previously-blocked pair's 5-second guard expires. Sweep
    // and reschedule the next deadline if any blocked pairs remain.
    await this.matchSweep();
  }

  // ─── Matching ────────────────────────────────────────────────────────────

  private listWaiters(): Array<{ ws: WebSocket; a: QueueAttachment }> {
    const out: Array<{ ws: WebSocket; a: QueueAttachment }> = [];
    for (const ws of this.state.getWebSockets()) {
      const a = ws.deserializeAttachment() as QueueAttachment | null;
      if (a?.joined) out.push({ ws, a });
    }
    out.sort((x, y) => x.a.joinedAt - y.a.joinedAt);
    return out;
  }

  private canMatch(a: QueueAttachment, b: QueueAttachment, now: number): boolean {
    if (a.userId === b.userId) return false; // safety: same user, two tabs racing
    const wereJustPaired = a.lastOpponentId === b.userId || b.lastOpponentId === a.userId;
    if (!wereJustPaired) return true;
    const longestWait = Math.max(now - a.joinedAt, now - b.joinedAt);
    return longestWait >= REMATCH_GUARD_MS;
  }

  private async matchSweep(): Promise<void> {
    const waiters = this.listWaiters();
    const matched = new Set<WebSocket>();
    const now = Date.now();

    // Phase 1: greedy FCFS pairing. Collect pairs first so room creation
    // (an async DO call) can fan out in parallel below.
    type Pair = [{ ws: WebSocket; a: QueueAttachment }, { ws: WebSocket; a: QueueAttachment }];
    const pairs: Pair[] = [];
    for (let i = 0; i < waiters.length; i++) {
      if (matched.has(waiters[i]!.ws)) continue;
      for (let j = i + 1; j < waiters.length; j++) {
        if (matched.has(waiters[j]!.ws)) continue;
        if (this.canMatch(waiters[i]!.a, waiters[j]!.a, now)) {
          pairs.push([waiters[i]!, waiters[j]!]);
          matched.add(waiters[i]!.ws);
          matched.add(waiters[j]!.ws);
          break;
        }
      }
    }

    // Phase 2: allocate rooms concurrently and notify each pair as they land.
    await Promise.all(pairs.map((p) => this.pair(p[0], p[1])));
    await this.scheduleUnblockAlarm();
  }

  private async pair(
    x: { ws: WebSocket; a: QueueAttachment },
    y: { ws: WebSocket; a: QueueAttachment },
  ): Promise<void> {
    let roomCode: string;
    try {
      // `createdBy` is informational only; either user works.
      ({ roomCode } = await createGameRoom(this.env, "1v1", x.a.userId));
    } catch (err) {
      const msg = (err as Error).message;
      this.sendError(x.ws, "pair_failed", msg);
      this.sendError(y.ws, "pair_failed", msg);
      return;
    }
    this.send(x.ws, { kind: "queue_matched", roomCode });
    this.send(y.ws, { kind: "queue_matched", roomCode });
    // Close the queue sockets — clients connect to the GameRoom WS next.
    try {
      x.ws.close(1000, "matched");
    } catch {
      /* ignore */
    }
    try {
      y.ws.close(1000, "matched");
    } catch {
      /* ignore */
    }
  }

  private async scheduleUnblockAlarm(): Promise<void> {
    // Find the earliest moment a currently-blocked pair would become eligible
    // (i.e. one of them crosses the 5-second guard). If nothing is blocked,
    // clear the alarm.
    const waiters = this.listWaiters();
    let earliest = Infinity;
    for (let i = 0; i < waiters.length; i++) {
      for (let j = i + 1; j < waiters.length; j++) {
        const a = waiters[i]!.a;
        const b = waiters[j]!.a;
        const wereJustPaired = a.lastOpponentId === b.userId || b.lastOpponentId === a.userId;
        if (!wereJustPaired) continue;
        // The guard relaxes once the *longer-waiting* of the two crosses 5s.
        const earlierJoin = Math.min(a.joinedAt, b.joinedAt);
        const eligibleAt = earlierJoin + REMATCH_GUARD_MS;
        if (eligibleAt < earliest) earliest = eligibleAt;
      }
    }
    if (earliest === Infinity) {
      await this.state.storage.deleteAlarm();
      return;
    }
    await this.state.storage.setAlarm(earliest);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private send(ws: WebSocket, msg: QueueServerMsg): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* socket gone */
    }
  }

  private sendError(ws: WebSocket, code: string, message: string): void {
    this.send(ws, { kind: "queue_error", code, message });
  }
}
