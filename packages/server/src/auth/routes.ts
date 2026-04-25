import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { LoginReq, UpgradeReq, AuthRes } from "@differ/shared";
import type { Env } from "../env.js";
import { getDb } from "../db/client.js";
import { users } from "../db/schema.js";
import { signToken } from "./jwt.js";
import { hashPassword, verifyPassword } from "./password.js";
import { requireAuth, type AuthEnv } from "./middleware.js";
import { checkRateLimit, guestKey, loginKey, upgradeKey } from "./rate-limit.js";
import { setTokenCookie, clearTokenCookie, setDeviceCookie, readDeviceCookie } from "./cookie.js";
import { verifyTurnstile } from "./turnstile.js";

function clientIp(c: { req: { header: (h: string) => string | undefined } }): string | undefined {
  return c.req.header("cf-connecting-ip");
}

function turnstileTokenFrom(raw: unknown): string | undefined {
  if (raw && typeof raw === "object" && "turnstileToken" in raw) {
    const v = (raw as { turnstileToken: unknown }).turnstileToken;
    if (typeof v === "string") return v;
  }
  return undefined;
}

export const authRoutes = new Hono<{ Bindings: Env }>();

function randomGuestName(): string {
  const n = Math.floor(Math.random() * 9000 + 1000);
  return `Guest#${n}`;
}

function genUserId(): string {
  return crypto.randomUUID();
}

authRoutes.post("/guest", async (c) => {
  const limited = await checkRateLimit(c.env.RL_GUEST, guestKey(c));
  if (limited) return limited;
  const raw = await c.req.json().catch(() => ({}));
  const ts = await verifyTurnstile(c.env.TURNSTILE_SECRET, turnstileTokenFrom(raw), clientIp(c));
  if (!ts.ok) {
    return c.json({ error: { code: "captcha_failed", message: "Captcha required" } }, 400);
  }

  const db = getDb(c.env.DB);

  // If the device cookie matches an existing guest user, re-bind to it.
  // We only reuse guest accounts — once the user upgraded with credentials,
  // they're expected to sign in with username/password.
  const existingDeviceId = readDeviceCookie(c);
  if (existingDeviceId) {
    const existing = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.deviceId, existingDeviceId), eq(users.isGuest, 1)))
      .get();
    if (existing) {
      const token = await signToken(c.env.JWT_SECRET, c.env.JWT_ISSUER, {
        userId: existing.id,
        name: existing.name,
        isGuest: true,
      });
      setTokenCookie(c, token);
      const body: AuthRes = {
        user: { userId: existing.id, name: existing.name, isGuest: true },
      };
      return c.json(body);
    }
  }

  // First-time visitor (or device cookie went stale). Mint a new guest +
  // device id. Store both in the cookie jar; logout clears only the token.
  const userId = genUserId();
  const name = randomGuestName();
  const deviceId = existingDeviceId ?? crypto.randomUUID();
  await db.insert(users).values({ id: userId, name, isGuest: 1, deviceId }).run();
  const token = await signToken(c.env.JWT_SECRET, c.env.JWT_ISSUER, {
    userId,
    name,
    isGuest: true,
  });
  setTokenCookie(c, token);
  setDeviceCookie(c, deviceId);
  const body: AuthRes = { user: { userId, name, isGuest: true } };
  return c.json(body);
});

authRoutes.post("/login", async (c) => {
  const raw = await c.req.json().catch(() => ({}));
  const parsed = LoginReq.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: { code: "bad_request", message: "Invalid body" } }, 400);
  }
  const { username, password } = parsed.data;
  // Key by IP+username so a single attacker can't grind one account, but
  // legitimate users on shared NAT aren't blocked by neighbors' typos.
  const limited = await checkRateLimit(c.env.RL_LOGIN, loginKey(c, username));
  if (limited) return limited;
  const ts = await verifyTurnstile(c.env.TURNSTILE_SECRET, turnstileTokenFrom(raw), clientIp(c));
  if (!ts.ok) {
    return c.json({ error: { code: "captcha_failed", message: "Captcha required" } }, 400);
  }
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
  setTokenCookie(c, token);
  const body: AuthRes = { user: { userId: row.id, name: row.name, isGuest: false } };
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
  const limited = await checkRateLimit(c.env.RL_UPGRADE, upgradeKey(c, claims.sub));
  if (limited) return limited;
  const raw = await c.req.json().catch(() => ({}));
  const ts = await verifyTurnstile(c.env.TURNSTILE_SECRET, turnstileTokenFrom(raw), clientIp(c));
  if (!ts.ok) {
    return c.json({ error: { code: "captcha_failed", message: "Captcha required" } }, 400);
  }
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
  setTokenCookie(c, token);
  const body: AuthRes = { user: { userId: claims.sub, name: username, isGuest: false } };
  return c.json(body);
});

protectedRoutes.post("/logout", (c) => {
  clearTokenCookie(c);
  return c.json({ ok: true });
});

authRoutes.route("/", protectedRoutes);
