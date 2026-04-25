// Cloudflare Turnstile invisible-widget helper.
//
// Single hidden widget rendered lazily on first call; subsequent calls reuse
// it (reset → execute → await callback). Tokens are single-use, so we always
// reset before requesting a new one. Returns `undefined` when no site key is
// configured — in that case the server is expected to also have an empty
// TURNSTILE_SECRET, leaving verification as a no-op.

import { TURNSTILE_SITE_KEY } from "../constants";

interface TurnstileApi {
  ready: (cb: () => void) => void;
  render: (el: HTMLElement | string, opts: TurnstileRenderOpts) => string;
  execute: (widgetId: string) => void;
  reset: (widgetId: string) => void;
}

interface TurnstileRenderOpts {
  sitekey: string;
  size?: "invisible" | "compact" | "normal";
  callback?: (token: string) => void;
  "error-callback"?: (code?: string) => void;
  "expired-callback"?: () => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let widgetId: string | null = null;
let pendingResolve: ((token: string) => void) | null = null;
let pendingReject: ((err: Error) => void) | null = null;

function waitForApi(): Promise<TurnstileApi> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = (): void => {
      if (window.turnstile) {
        resolve(window.turnstile);
        return;
      }
      if (Date.now() - start > 10_000) {
        reject(new Error("turnstile script failed to load"));
        return;
      }
      setTimeout(tick, 50);
    };
    tick();
  });
}

async function ensureWidget(): Promise<{ api: TurnstileApi; id: string }> {
  const api = await waitForApi();
  if (widgetId) return { api, id: widgetId };

  // Off-screen container. `display:none` would prevent the challenge iframe
  // from initializing; positioning off-canvas keeps it functional but invisible.
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "-10000px";
  container.style.width = "0";
  container.style.height = "0";
  container.style.overflow = "hidden";
  document.body.appendChild(container);

  await new Promise<void>((resolve) => api.ready(resolve));

  widgetId = api.render(container, {
    sitekey: TURNSTILE_SITE_KEY,
    size: "invisible",
    callback: (token) => {
      pendingResolve?.(token);
      pendingResolve = null;
      pendingReject = null;
    },
    "error-callback": (code) => {
      pendingReject?.(new Error(`turnstile failed${code ? `: ${code}` : ""}`));
      pendingResolve = null;
      pendingReject = null;
    },
  });

  return { api, id: widgetId };
}

export async function getTurnstileToken(): Promise<string | undefined> {
  if (!TURNSTILE_SITE_KEY) return undefined;
  const { api, id } = await ensureWidget();
  return new Promise<string>((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject = reject;
    api.reset(id);
    api.execute(id);
  });
}
