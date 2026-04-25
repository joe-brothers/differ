// Cloudflare Turnstile invisible-widget helper.
//
// Single hidden widget rendered lazily on first call; subsequent calls reuse
// it (reset → execute → await callback). Tokens are single-use, so we always
// reset before requesting a new one. Returns `undefined` when no site key is
// configured — in that case the server is expected to also have an empty
// TURNSTILE_SECRET, leaving verification as a no-op.
//
// Lifecycle: index.html loads api.js with `?onload=onloadTurnstileCallback&
// render=explicit`. The inline pre-script defines the callback which sets
// `window.__turnstileReady = true`. We poll that flag rather than calling
// `turnstile.ready()` (which logs a misleading warning on first invocation).

import { TURNSTILE_SITE_KEY } from "../constants";

interface TurnstileApi {
  render: (el: HTMLElement | string, opts: TurnstileRenderOpts) => string;
  execute: (widgetId: string) => void;
  reset: (widgetId: string) => void;
}

interface TurnstileRenderOpts {
  sitekey: string;
  appearance?: "always" | "execute" | "interaction-only";
  callback?: (token: string) => void;
  "error-callback"?: (code?: string) => void;
  "expired-callback"?: () => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    __turnstileReady?: boolean;
  }
}

let widgetId: string | null = null;
let pendingResolve: ((token: string) => void) | null = null;
let pendingReject: ((err: Error) => void) | null = null;

function waitForApi(): Promise<TurnstileApi> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = (): void => {
      if (window.__turnstileReady && window.turnstile) {
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

  widgetId = api.render(container, {
    sitekey: TURNSTILE_SITE_KEY,
    // Invisible behavior comes from the widget's mode in the Cloudflare
    // dashboard. `interaction-only` keeps the UI hidden until a managed
    // challenge actually needs the user — `size: "invisible"` is no longer
    // a valid value in the current API.
    appearance: "interaction-only",
    callback: (token) => {
      const r = pendingResolve;
      pendingResolve = null;
      pendingReject = null;
      // Reset BEFORE resolving so the widget is ready for the next execute()
      // by the time the awaiting caller chains its next request.
      if (widgetId) api.reset(widgetId);
      r?.(token);
    },
    "error-callback": (code) => {
      const j = pendingReject;
      pendingResolve = null;
      pendingReject = null;
      if (widgetId) api.reset(widgetId);
      j?.(new Error(`turnstile failed${code ? `: ${code}` : ""}`));
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
    // No reset() here — the widget is reset inside callback/error-callback
    // after each token use, so it's already idle when we get here.
    api.execute(id);
  });
}
