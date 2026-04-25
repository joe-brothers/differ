import { type ClientMsg, ServerMsg } from "@differ/shared";
import { EventEmitter } from "pixi.js";

// Wraps a single WebSocket connection to a GameRoom DO.
// Emits typed server messages as events keyed by `kind`.
// Auth happens via cookie at the WebSocket upgrade — no token in the URL or
// in any client message. The browser attaches the cookie automatically.
export class RoomSocket extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private opened = false;
  private closed = false;

  constructor(url: string) {
    super();
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.addEventListener("open", () => {
        this.opened = true;
        // Pure handshake — the server already knows who we are from the
        // upgrade-time cookie verification.
        ws.send(JSON.stringify({ kind: "hello" } satisfies ClientMsg));
        resolve();
      });
      ws.addEventListener("message", (ev) => {
        let raw: unknown;
        try {
          raw = JSON.parse(ev.data as string);
        } catch {
          return;
        }
        const parsed = ServerMsg.safeParse(raw);
        if (!parsed.success) {
          console.warn("bad server msg", parsed.error, raw);
          return;
        }
        this.emit(parsed.data.kind, parsed.data);
        this.emit("message", parsed.data);
      });
      ws.addEventListener("close", (ev) => {
        this.closed = true;
        this.emit("close", ev.code, ev.reason);
        if (!this.opened) reject(new Error("ws closed before open"));
      });
      ws.addEventListener("error", () => {
        if (!this.opened) reject(new Error("ws error before open"));
      });
    });
  }

  send(msg: ClientMsg): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(msg));
  }

  close(): void {
    this.closed = true;
    try {
      this.ws?.close(1000);
    } catch {
      /* ignore */
    }
  }

  isClosed(): boolean {
    return this.closed;
  }
}
