import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { LoginReq, UpgradeReq, AuthRes } from "@differ/shared";
import type { Env } from "../env.js";
import { getDb } from "../db/client.js";
import { users } from "../db/schema.js";
import { signToken } from "./jwt.js";
import { hashPassword, verifyPassword } from "./password.js";
import { requireAuth, type AuthEnv } from "./middleware.js";

export const authRoutes = new Hono<{ Bindings: Env }>();

function randomGuestName(): string {
  const n = Math.floor(Math.random() * 9000 + 1000);
  return `Guest#${n}`;
}

function genUserId(): string {
  return crypto.randomUUID();
}

authRoutes.post("/guest", async (c) => {
  const userId = genUserId();
  const name = randomGuestName();
  const db = getDb(c.env.DB);
  await db.insert(users).values({ id: userId, name, isGuest: 1 }).run();
  const token = await signToken(c.env.JWT_SECRET, c.env.JWT_ISSUER, {
    userId,
    name,
    isGuest: true,
  });
  const body: AuthRes = { token, user: { userId, name, isGuest: true } };
  return c.json(body);
});

authRoutes.post("/login", async (c) => {
  const raw = await c.req.json().catch(() => ({}));
  const parsed = LoginReq.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: { code: "bad_request", message: "Invalid body" } }, 400);
  }
  const { username, password } = parsed.data;
  const db = getDb(c.env.DB);
  const row = await db
    .select({
      id: users.id,
      name: users.name,
      passwordHash: users.passwordHash,
      isGuest: users.isGuest,
    })
    .from(users)
    .where(eq(users.username, username))
    .get();
  if (!row || !row.passwordHash) {
    return c.json({ error: { code: "invalid_credentials", message: "Invalid credentials" } }, 401);
  }
  const ok = await verifyPassword(password, row.passwordHash);
  if (!ok) {
    return c.json({ error: { code: "invalid_credentials", message: "Invalid credentials" } }, 401);
  }
  const token = await signToken(c.env.JWT_SECRET, c.env.JWT_ISSUER, {
    userId: row.id,
    name: row.name,
    isGuest: false,
  });
  const body: AuthRes = { token, user: { userId: row.id, name: row.name, isGuest: false } };
  return c.json(body);
});

const protectedRoutes = new Hono<AuthEnv>();
protectedRoutes.use("*", requireAuth);

protectedRoutes.get("/me", async (c) => {
  const claims = c.get("user");
  const db = getDb(c.env.DB);
  const row = await db
    .select({ id: users.id, name: users.name, isGuest: users.isGuest })
    .from(users)
    .where(eq(users.id, claims.sub))
    .get();
  if (!row) {
    return c.json({ error: { code: "not_found", message: "User gone" } }, 404);
  }
  return c.json({ user: { userId: row.id, name: row.name, isGuest: row.isGuest === 1 } });
});

protectedRoutes.post("/upgrade", async (c) => {
  const claims = c.get("user");
  if (!claims.isGuest) {
    return c.json(
      { error: { code: "already_registered", message: "Account already has credentials" } },
      409,
    );
  }
  const raw = await c.req.json().catch(() => ({}));
  const parsed = UpgradeReq.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: { code: "bad_request", message: parsed.error.message } }, 400);
  }
  const { username, password } = parsed.data;
  const db = getDb(c.env.DB);

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .get();
  if (existing) {
    return c.json({ error: { code: "username_taken", message: "Username already taken" } }, 409);
  }

  const hash = await hashPassword(password);
  const updated = await db
    .update(users)
    .set({ username, passwordHash: hash, name: username, isGuest: 0 })
    .where(and(eq(users.id, claims.sub), eq(users.isGuest, 1)))
    .returning({ id: users.id });

  if (updated.length === 0) {
    return c.json({ error: { code: "conflict", message: "Upgrade failed" } }, 409);
  }

  const token = await signToken(c.env.JWT_SECRET, c.env.JWT_ISSUER, {
    userId: claims.sub,
    name: username,
    isGuest: false,
  });
  const body: AuthRes = { token, user: { userId: claims.sub, name: username, isGuest: false } };
  return c.json(body);
});

authRoutes.route("/", protectedRoutes);
