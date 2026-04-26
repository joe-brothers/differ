import {
  type QueueClientMsg,
  QueueServerMsg,
  type QueueServerMatched,
  type QueueServerError,
} from "@differ/shared";
import { EventEmitter } from "pixi.js";

// Wraps a single WebSocket to the singleton MatchmakingQueue DO.
// Auth is via cookie at upgrade — no token in any client message.
export class QueueSocket extends EventEmitter {
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
        resolve();
      });
      ws.addEventListener("message", (ev) => {
        let raw: unknown;
        try {
          raw = JSON.parse(ev.data as string);
        } catch {
          return;
        }
        const parsed = QueueServerMsg.safeParse(raw);
        if (!parsed.success) {
          console.warn("bad queue msg", parsed.error, raw);
          return;
        }
        this.emit(parsed.data.kind, parsed.data);
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

  send(msg: QueueClientMsg): void {
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

export type { QueueServerMatched, QueueServerError };
