import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { Env } from "./env.js";
import { authRoutes } from "./auth/routes.js";
import { roomRoutes } from "./rooms/routes.js";
import { leaderboardRoutes } from "./leaderboard/routes.js";

export { GameRoom } from "./rooms/game-room.js";

const app = new Hono<{ Bindings: Env }>();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (o) => o,
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  }),
);

app.get("/health", (c) => c.json({ ok: true }));

app.route("/auth", authRoutes);
app.route("/rooms", roomRoutes);
app.route("/leaderboard", leaderboardRoutes);

app.notFound((c) => c.json({ error: { code: "not_found", message: "Not found" } }, 404));
app.onError((err, c) => {
  console.error(err);
  const status = (err as { status?: number }).status ?? 500;
  return c.json({ error: { code: "internal", message: err.message } }, status as 500);
});

export default app;
