import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import type { Env } from "./env.js";
import { authRoutes } from "./auth/routes.js";
import { roomRoutes } from "./rooms/routes.js";
import { leaderboardRoutes } from "./leaderboard/routes.js";
import { matchmakingRoutes } from "./matchmaking/routes.js";

export { GameRoom } from "./rooms/game-room.js";
export { MatchmakingQueue } from "./matchmaking/queue.js";

const app = new Hono<{ Bindings: Env }>();

app.use("*", logger());

// CORS: allow only origins listed in ALLOWED_ORIGINS. Empty list (dev) falls
// back to reflecting the request origin so localhost setups don't break.
app.use("*", (c, next) => {
  const allowList = (c.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return cors({
    origin: (origin) => {
      if (allowList.length === 0) return origin; // dev: any origin
      return allowList.includes(origin) ? origin : null;
    },
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })(c, next);
});

app.use(
  "*",
  secureHeaders({
    strictTransportSecurity: "max-age=31536000; includeSubDomains",
    xFrameOptions: "DENY",
    xContentTypeOptions: "nosniff",
    referrerPolicy: "strict-origin-when-cross-origin",
    // This is a JSON API, no HTML — lock CSP down hard.
    contentSecurityPolicy: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
    // Disabled for an API: COEP breaks cross-origin fetches from the SPA.
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: "same-site",
    crossOriginOpenerPolicy: false,
  }),
);

app.get("/health", (c) => c.json({ ok: true }));

app.route("/auth", authRoutes);
app.route("/rooms", roomRoutes);
app.route("/leaderboard", leaderboardRoutes);
app.route("/matchmaking", matchmakingRoutes);

app.notFound((c) => c.json({ error: { code: "not_found", message: "Not found" } }, 404));
app.onError((err, c) => {
  console.error(err);
  const status = (err as { status?: number }).status ?? 500;
  return c.json({ error: { code: "internal", message: err.message } }, status as 500);
});

export default app;
