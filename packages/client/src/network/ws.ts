import {
  type ClientMsg,
  ServerMsg,
} from "@differ/shared";
import { EventEmitter } from "pixi.js";

// Wraps a single WebSocket connection to a GameRoom DO.
// Emits typed server messages as events keyed by `kind`.
export class RoomSocket extends EventEmitter {
  private ws: WebSocket | null = null;
  private token: string;
  private url: string;
  private opened = false;
  private closed = false;

  constructor(url: string, token: string) {
    super();
    this.url = url;
    this.token = token;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.addEventListener("open", () => {
        this.opened = true;
        ws.send(JSON.stringify({ kind: "hello", token: this.token } satisfies ClientMsg));
        resolve();
      });
      ws.addEventListener("message", (ev) => {
        let raw: unknown;
        try { raw = JSON.parse(ev.data as string); }
        catch { return; }
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
    try { this.ws?.close(1000); } catch { /* ignore */ }
  }

  isClosed(): boolean {
    return this.closed;
  }
}
