import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import {
  LoginReq,
  LoginTotpReq,
  UpgradeReq,
  AuthRes,
  TotpVerifyReq,
  TotpDisableReq,
  ForgotPasswordReq,
  SetEmailReq,
} from "@differ/shared";
import type { Env } from "../env.js";
import { getDb } from "../db/client.js";
import { users } from "../db/schema.js";
import { signToken, signTotpTicket, verifyTotpTicket } from "./jwt.js";
import { hashPassword, verifyPassword } from "./password.js";
import { requireAuth, type AuthEnv } from "./middleware.js";
import { checkRateLimit, guestKey, loginKey, upgradeKey } from "./rate-limit.js";
import { setTokenCookie, clearTokenCookie, setDeviceCookie, readDeviceCookie } from "./cookie.js";
import { verifyTurnstile } from "./turnstile.js";
import { checkPasswordStrength } from "./password-policy.js";
import { generateSecret, buildOtpAuthUrl, verifyTotpCode } from "./totp.js";

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
      totpEnabled: users.totpEnabled,
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
  if (row.totpEnabled === 1) {
    // Defer cookie issuance until the second-factor step succeeds.
    const ticket = await signTotpTicket(c.env.JWT_SECRET, c.env.JWT_ISSUER, row.id);
    return c.json({ totpRequired: true as const, ticket });
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

authRoutes.post("/login/totp", async (c) => {
  const raw = await c.req.json().catch(() => ({}));
  const parsed = LoginTotpReq.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: { code: "bad_request", message: "Invalid body" } }, 400);
  }
  const { ticket, code } = parsed.data;
  const userId = await verifyTotpTicket(c.env.JWT_SECRET, ticket);
  if (!userId) {
    return c.json(
      { error: { code: "ticket_invalid", message: "Login session expired, sign in again" } },
      401,
    );
  }
  // Reuse the login limiter, keyed by userId so a stolen ticket can't grind
  // codes faster than legit users.
  const limited = await checkRateLimit(c.env.RL_LOGIN, `totp:${userId}`);
  if (limited) return limited;
  const db = getDb(c.env.DB);
  const row = await db
    .select({
      id: users.id,
      name: users.name,
      totpSecret: users.totpSecret,
      totpEnabled: users.totpEnabled,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!row || row.totpEnabled !== 1 || !row.totpSecret) {
    return c.json({ error: { code: "invalid_credentials", message: "Invalid credentials" } }, 401);
  }
  const okCode = await verifyTotpCode(row.totpSecret, code);
  if (!okCode) {
    return c.json({ error: { code: "invalid_totp", message: "Invalid code" } }, 401);
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
    const first = parsed.error.issues[0];
    return c.json(
      { error: { code: "bad_request", message: first?.message ?? "Invalid body" } },
      400,
    );
  }
  const { username, password } = parsed.data;

  const strength = checkPasswordStrength(password, [username, claims.name]);
  if (!strength.ok) {
    return c.json(
      { error: { code: "weak_password", message: strength.reason ?? "Password is too weak" } },
      400,
    );
  }

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

// --- TOTP (2FA) management ---------------------------------------------
// All TOTP routes require an authenticated session. Guest accounts can't
// enable 2FA — there's no password to fall back to.

protectedRoutes.get("/totp/status", async (c) => {
  const claims = c.get("user");
  const db = getDb(c.env.DB);
  const row = await db
    .select({ totpEnabled: users.totpEnabled })
    .from(users)
    .where(eq(users.id, claims.sub))
    .get();
  return c.json({ enabled: row?.totpEnabled === 1 });
});

protectedRoutes.post("/totp/setup", async (c) => {
  const claims = c.get("user");
  if (claims.isGuest) {
    return c.json(
      { error: { code: "guest_forbidden", message: "Sign up before enabling 2FA" } },
      403,
    );
  }
  const db = getDb(c.env.DB);
  const row = await db
    .select({ totpEnabled: users.totpEnabled, name: users.name })
    .from(users)
    .where(eq(users.id, claims.sub))
    .get();
  if (!row) {
    return c.json({ error: { code: "not_found", message: "User gone" } }, 404);
  }
  if (row.totpEnabled === 1) {
    return c.json(
      { error: { code: "already_enabled", message: "Disable 2FA first to re-enroll" } },
      409,
    );
  }
  const secret = generateSecret();
  await db
    .update(users)
    .set({ totpSecret: secret, totpEnabled: 0 })
    .where(eq(users.id, claims.sub))
    .run();
  const otpauthUrl = buildOtpAuthUrl({
    secret,
    account: row.name,
    issuer: c.env.JWT_ISSUER || "Differ",
  });
  return c.json({ secret, otpauthUrl });
});

protectedRoutes.post("/totp/verify", async (c) => {
  const claims = c.get("user");
  const raw = await c.req.json().catch(() => ({}));
  const parsed = TotpVerifyReq.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: { code: "bad_request", message: "Invalid body" } }, 400);
  }
  const db = getDb(c.env.DB);
  const row = await db
    .select({ totpSecret: users.totpSecret })
    .from(users)
    .where(eq(users.id, claims.sub))
    .get();
  if (!row?.totpSecret) {
    return c.json({ error: { code: "not_setup", message: "Run TOTP setup first" } }, 400);
  }
  const ok = await verifyTotpCode(row.totpSecret, parsed.data.code);
  if (!ok) {
    return c.json({ error: { code: "invalid_totp", message: "Invalid code" } }, 401);
  }
  await db.update(users).set({ totpEnabled: 1 }).where(eq(users.id, claims.sub)).run();
  return c.json({ ok: true, enabled: true });
});

protectedRoutes.post("/totp/disable", async (c) => {
  const claims = c.get("user");
  const raw = await c.req.json().catch(() => ({}));
  const parsed = TotpDisableReq.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: { code: "bad_request", message: "Invalid body" } }, 400);
  }
  const db = getDb(c.env.DB);
  const row = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, claims.sub))
    .get();
  if (!row?.passwordHash) {
    return c.json({ error: { code: "invalid_credentials", message: "Invalid credentials" } }, 401);
  }
  const okPwd = await verifyPassword(parsed.data.password, row.passwordHash);
  if (!okPwd) {
    return c.json({ error: { code: "invalid_credentials", message: "Invalid credentials" } }, 401);
  }
  await db
    .update(users)
    .set({ totpSecret: null, totpEnabled: 0 })
    .where(eq(users.id, claims.sub))
    .run();
  return c.json({ ok: true, enabled: false });
});

// --- Email (mockup) ----------------------------------------------------
// Real email delivery (verification, password reset) is not wired up yet.
// These endpoints persist the address and return a stub response so the
// client UX can be built end-to-end; swap out the bodies once a transport
// (Resend / SES / Mailgun) is chosen.

protectedRoutes.post("/email", async (c) => {
  const claims = c.get("user");
  if (claims.isGuest) {
    return c.json(
      { error: { code: "guest_forbidden", message: "Sign up before adding an email" } },
      403,
    );
  }
  const raw = await c.req.json().catch(() => ({}));
  const parsed = SetEmailReq.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: { code: "bad_request", message: "Invalid email" } }, 400);
  }
  const db = getDb(c.env.DB);
  try {
    await db.update(users).set({ email: parsed.data.email }).where(eq(users.id, claims.sub)).run();
  } catch {
    // unique constraint on email
    return c.json({ error: { code: "email_taken", message: "Email already in use" } }, 409);
  }
  return c.json({ ok: true, email: parsed.data.email, mocked: true });
});

protectedRoutes.get("/email", async (c) => {
  const claims = c.get("user");
  const db = getDb(c.env.DB);
  const row = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, claims.sub))
    .get();
  return c.json({ email: row?.email ?? null });
});

authRoutes.route("/", protectedRoutes);

// Mockup forgot-password endpoint. Always returns 200 so we don't leak
// account existence; replace the body with an actual mail enqueue once
// transport is wired up.
authRoutes.post("/forgot-password", async (c) => {
  const raw = await c.req.json().catch(() => ({}));
  const parsed = ForgotPasswordReq.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: { code: "bad_request", message: "Invalid body" } }, 400);
  }
  // TODO(SEC-11): wire to a real mail transport. For now we just acknowledge.
  return c.json({ ok: true, mocked: true });
});
