import { Hono } from "hono";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import {
  LoginReq,
  LoginTotpReq,
  UpgradeReq,
  AuthRes,
  TotpVerifyReq,
  TotpDisableReq,
  ForgotPasswordReq,
  SetEmailReq,
  VerifyEmailReq,
  ResetPasswordReq,
  type EmailStatusRes,
  type GameMode,
  type RecentGameEntry,
  type RecentGameOutcome,
  type RecentGamesRes,
} from "@differ/shared";
import type { Env } from "../env.js";
import { getDb } from "../db/client.js";
import { gameParticipants, games, users } from "../db/schema.js";
import { getDailyState } from "../daily/service.js";
import { signToken, signTotpTicket, verifyTotpTicket } from "./jwt.js";
import { hashPassword, verifyPassword, needsRehash, dummyVerifyForTiming } from "./password.js";
import { requireAuth, type AuthEnv } from "./middleware.js";
import {
  checkRateLimit,
  emailIpKey,
  guestKey,
  loginKey,
  totpKey,
  upgradeKey,
} from "./rate-limit.js";
import {
  EMAIL_USER_COOLDOWN_SEC,
  RESET_TOKEN_TTL_SEC,
  VERIFY_TOKEN_TTL_SEC,
  consumeEmailToken,
  isUserInCooldown,
  issueEmailToken,
  parseSqliteUtc,
  sendResetEmail,
  sendVerificationEmail,
  stampUserSent,
} from "./email.js";
import { setTokenCookie, clearTokenCookie, setDeviceCookie, readDeviceCookie } from "./cookie.js";
import { verifyTurnstile } from "./turnstile.js";
import { generateSecret, buildOtpAuthUrl, verifyTotpCode } from "./totp.js";
import { encryptTotpSecret, decryptTotpSecret } from "./totp-crypto.js";

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

authRoutes.use("*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
});

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
  const { password } = parsed.data;
  // Stored usernames are lowercase; lookups must match.
  const username = parsed.data.username.toLowerCase();
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
    // Match the verify-path latency so timing doesn't reveal account existence.
    await dummyVerifyForTiming(password);
    return c.json({ error: { code: "invalid_credentials", message: "Invalid credentials" } }, 401);
  }
  const ok = await verifyPassword(password, row.passwordHash);
  if (!ok) {
    return c.json({ error: { code: "invalid_credentials", message: "Invalid credentials" } }, 401);
  }
  // Transparent hash upgrade for legacy (pbkdf2) users. Best-effort:
  // a write failure shouldn't block the login.
  if (needsRehash(row.passwordHash)) {
    try {
      const fresh = await hashPassword(password);
      await db.update(users).set({ passwordHash: fresh }).where(eq(users.id, row.id)).run();
    } catch (err) {
      console.error("password rehash failed", { userId: row.id, err: String(err) });
    }
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
  // Keyed by userId so a ticket replayed from many IPs still hits one bucket.
  const limited = await checkRateLimit(c.env.RL_TOTP, totpKey(userId));
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
  let plainSecret: string;
  try {
    plainSecret = await decryptTotpSecret(row.totpSecret, c.env.TOTP_KEK);
  } catch (err) {
    console.error("totp decrypt failed", { userId: row.id, err: String(err) });
    return c.json({ error: { code: "invalid_credentials", message: "Invalid credentials" } }, 401);
  }
  const okCode = await verifyTotpCode(plainSecret, code);
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
  // Wins = number of 1v1 victories. Single-mode completions are still
  // persisted (for the fastest-time leaderboard) but don't count as wins.
  // Guests read 0 even though their rows exist — past plays only surface
  // after upgrade flips isGuest to 0.
  let wins = 0;
  if (row.isGuest === 0) {
    const winsRow = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(gameParticipants)
      .where(
        and(
          eq(gameParticipants.userId, claims.sub),
          eq(gameParticipants.mode, "1v1"),
          eq(gameParticipants.outcome, "win"),
        ),
      )
      .get();
    wins = winsRow?.c ?? 0;
  }
  // Bundled with daily state so the menu can render on a single round trip.
  // The lazy streak reset (when lastDailyDate < yesterday) lives inside
  // getDailyState; calling it here means it kicks in on session start.
  const daily = await getDailyState(c.env.DB, claims.sub);
  return c.json({
    user: { userId: row.id, name: row.name, isGuest: row.isGuest === 1 },
    wins,
    daily,
  });
});

// Recent N games for the current user. Two queries: my participations
// (with the parent game's end_reason), then opponent rows for any 1v1
// gameIds, merged in JS. Guests get an empty list — same posture as the
// wins counter — so history only surfaces post-upgrade.
protectedRoutes.get("/me/recent", async (c) => {
  const claims = c.get("user");
  const limitRaw = Number(c.req.query("limit") ?? 20);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, Math.trunc(limitRaw))) : 20;
  const db = getDb(c.env.DB);

  const userRow = await db
    .select({ isGuest: users.isGuest })
    .from(users)
    .where(eq(users.id, claims.sub))
    .get();
  if (!userRow) {
    return c.json({ error: { code: "not_found", message: "User gone" } }, 404);
  }
  if (userRow.isGuest === 1) {
    const empty: RecentGamesRes = { games: [] };
    return c.json(empty);
  }

  const mine = await db
    .select({
      gameId: gameParticipants.gameId,
      mode: gameParticipants.mode,
      outcome: gameParticipants.outcome,
      elapsedMs: gameParticipants.elapsedMs,
      foundCount: gameParticipants.foundCount,
      endedAt: gameParticipants.endedAt,
      endReason: games.endReason,
    })
    .from(gameParticipants)
    .innerJoin(games, eq(games.id, gameParticipants.gameId))
    .where(eq(gameParticipants.userId, claims.sub))
    .orderBy(desc(gameParticipants.endedAt))
    .limit(limit);

  const versusGameIds = mine.filter((m) => m.mode === "1v1").map((m) => m.gameId);
  const opponentRows = versusGameIds.length
    ? await db
        .select({
          gameId: gameParticipants.gameId,
          userId: gameParticipants.userId,
          name: users.name,
          outcome: gameParticipants.outcome,
          elapsedMs: gameParticipants.elapsedMs,
          foundCount: gameParticipants.foundCount,
        })
        .from(gameParticipants)
        .innerJoin(users, eq(users.id, gameParticipants.userId))
        .where(
          and(
            inArray(gameParticipants.gameId, versusGameIds),
            ne(gameParticipants.userId, claims.sub),
          ),
        )
    : [];
  const opponentByGame = new Map<string, (typeof opponentRows)[number]>();
  for (const o of opponentRows) opponentByGame.set(o.gameId, o);

  const entries: RecentGameEntry[] = mine.map((m) => ({
    gameId: m.gameId,
    mode: m.mode as GameMode,
    endedAt: m.endedAt,
    endReason: m.endReason as "winner" | "timeout",
    outcome: m.outcome as RecentGameOutcome,
    elapsedMs: m.elapsedMs,
    foundCount: m.foundCount,
    opponent: (() => {
      const o = opponentByGame.get(m.gameId);
      if (!o) return null;
      return {
        userId: o.userId,
        name: o.name,
        outcome: o.outcome as RecentGameOutcome,
        elapsedMs: o.elapsedMs,
        foundCount: o.foundCount,
      };
    })(),
  }));

  const body: RecentGamesRes = { games: entries };
  return c.json(body);
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
  const { password } = parsed.data;
  // username is the lookup key (lowercased to prevent "Alice"/"alice"
  // squatting); `name` keeps the original casing for display.
  const displayName = parsed.data.username;
  const username = displayName.toLowerCase();
  // Strength gate is intentionally just the Zod regex (length + letter +
  // digit). zxcvbn runs only on the client as a visual nudge.

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
    .set({ username, passwordHash: hash, name: displayName, isGuest: 0 })
    .where(and(eq(users.id, claims.sub), eq(users.isGuest, 1)))
    .returning({ id: users.id });

  if (updated.length === 0) {
    return c.json({ error: { code: "conflict", message: "Upgrade failed" } }, 409);
  }

  const token = await signToken(c.env.JWT_SECRET, c.env.JWT_ISSUER, {
    userId: claims.sub,
    name: displayName,
    isGuest: false,
  });
  setTokenCookie(c, token);
  const body: AuthRes = { user: { userId: claims.sub, name: displayName, isGuest: false } };
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
  const encryptedSecret = await encryptTotpSecret(secret, c.env.TOTP_KEK);
  await db
    .update(users)
    .set({ totpSecret: encryptedSecret, totpEnabled: 0 })
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
  let plainSecret: string;
  try {
    plainSecret = await decryptTotpSecret(row.totpSecret, c.env.TOTP_KEK);
  } catch (err) {
    console.error("totp decrypt failed", { userId: claims.sub, err: String(err) });
    return c.json({ error: { code: "not_setup", message: "Run TOTP setup first" } }, 400);
  }
  const ok = await verifyTotpCode(plainSecret, parsed.data.code);
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
  const updates: { totpSecret: null; totpEnabled: 0; passwordHash?: string } = {
    totpSecret: null,
    totpEnabled: 0,
  };
  if (needsRehash(row.passwordHash)) {
    try {
      updates.passwordHash = await hashPassword(parsed.data.password);
    } catch (err) {
      console.error("password rehash failed", { userId: claims.sub, err: String(err) });
    }
  }
  await db.update(users).set(updates).where(eq(users.id, claims.sub)).run();
  return c.json({ ok: true, enabled: false });
});

// --- Email (verification + password reset) ----------------------------
// Cost defenses:
//  1. RL_EMAIL (per-IP, 3/min) sits in front of every send-triggering route.
//  2. users.last_email_sent_at gives a per-user 60s cooldown — covers a
//     legit user spamming "Resend" past the IP limiter via different routes.
//  3. Tokens are single-use; issuing a new one invalidates prior ones.
//  4. /forgot-password responds identically for missing/unverified accounts
//     so an enumerator can't probe which usernames have valid email on file.

function cooldownRemaining(lastEmailSentAt: string | null): number {
  const last = parseSqliteUtc(lastEmailSentAt);
  if (last === null) return 0;
  const remaining = EMAIL_USER_COOLDOWN_SEC - Math.floor((Date.now() - last) / 1000);
  return Math.max(0, remaining);
}

protectedRoutes.post("/email", async (c) => {
  const claims = c.get("user");
  if (claims.isGuest) {
    return c.json(
      { error: { code: "guest_forbidden", message: "Sign up before adding an email" } },
      403,
    );
  }
  const limited = await checkRateLimit(c.env.RL_EMAIL, emailIpKey(c));
  if (limited) return limited;
  const raw = await c.req.json().catch(() => ({}));
  const parsed = SetEmailReq.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: { code: "bad_request", message: "Invalid email" } }, 400);
  }
  const email = parsed.data.email.trim().toLowerCase();
  const db = getDb(c.env.DB);
  // Cooldown check first — we want to reject before mutating state, so a
  // failed attempt doesn't leave the user with an updated-but-not-verified
  // address. The shared row read also gives us the current email for
  // idempotent "submit same value twice" handling.
  const current = await db
    .select({
      email: users.email,
      verifiedAt: users.emailVerifiedAt,
      lastSent: users.lastEmailSentAt,
    })
    .from(users)
    .where(eq(users.id, claims.sub))
    .get();
  if (current?.email === email && current.verifiedAt) {
    // Already on file and verified — no-op rather than burn a send.
    return c.json({ ok: true, email, verified: true });
  }
  if (await isUserInCooldown(db, claims.sub)) {
    return c.json(
      { error: { code: "rate_limited", message: "Please wait before resending" } },
      429,
    );
  }
  // Setting an address (re-)starts verification. Clearing email_verified_at
  // is intentional — even if the user re-enters their old address, we want a
  // fresh proof-of-control before treating it as authoritative.
  try {
    await db
      .update(users)
      .set({ email, emailVerifiedAt: null })
      .where(eq(users.id, claims.sub))
      .run();
  } catch {
    return c.json({ error: { code: "email_taken", message: "Email already in use" } }, 409);
  }
  const token = await issueEmailToken(db, {
    userId: claims.sub,
    email,
    purpose: "verify",
    ttlSec: VERIFY_TOKEN_TTL_SEC,
  });
  await stampUserSent(db, claims.sub);
  await sendVerificationEmail(c.env, { to: email, username: claims.name, token });
  return c.json({ ok: true, email, verified: false });
});

protectedRoutes.get("/email", async (c) => {
  const claims = c.get("user");
  const db = getDb(c.env.DB);
  const row = await db
    .select({
      email: users.email,
      verifiedAt: users.emailVerifiedAt,
      lastSent: users.lastEmailSentAt,
    })
    .from(users)
    .where(eq(users.id, claims.sub))
    .get();
  const body: EmailStatusRes = {
    email: row?.email ?? null,
    verified: !!row?.verifiedAt,
    resendCooldownSec: cooldownRemaining(row?.lastSent ?? null),
  };
  return c.json(body);
});

protectedRoutes.post("/email/resend", async (c) => {
  const claims = c.get("user");
  if (claims.isGuest) {
    return c.json({ error: { code: "guest_forbidden", message: "Sign up first" } }, 403);
  }
  const limited = await checkRateLimit(c.env.RL_EMAIL, emailIpKey(c));
  if (limited) return limited;
  const db = getDb(c.env.DB);
  const row = await db
    .select({ email: users.email, verifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.id, claims.sub))
    .get();
  if (!row?.email) {
    return c.json({ error: { code: "no_email", message: "Add an email first" } }, 400);
  }
  if (row.verifiedAt) {
    // Already verified — return 200 idempotently rather than spending a send.
    return c.json({ ok: true, verified: true });
  }
  if (await isUserInCooldown(db, claims.sub)) {
    return c.json(
      { error: { code: "rate_limited", message: "Please wait before resending" } },
      429,
    );
  }
  const token = await issueEmailToken(db, {
    userId: claims.sub,
    email: row.email,
    purpose: "verify",
    ttlSec: VERIFY_TOKEN_TTL_SEC,
  });
  await stampUserSent(db, claims.sub);
  await sendVerificationEmail(c.env, { to: row.email, username: claims.name, token });
  return c.json({ ok: true });
});

// Public verification endpoint. The link in the email points the user back
// to the SPA, which POSTs the token here. Auth is not required — the token
// itself is the auth, and the row binds it to the user.
authRoutes.post("/email/verify", async (c) => {
  const limited = await checkRateLimit(c.env.RL_EMAIL, emailIpKey(c));
  if (limited) return limited;
  const raw = await c.req.json().catch(() => ({}));
  const parsed = VerifyEmailReq.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: { code: "bad_request", message: "Invalid token" } }, 400);
  }
  const db = getDb(c.env.DB);
  const tok = await consumeEmailToken(db, parsed.data.token, "verify");
  if (!tok) {
    return c.json(
      { error: { code: "invalid_token", message: "Link expired or already used" } },
      400,
    );
  }
  // Race: user may have changed their email after issuing the token. Only
  // mark verified if the address still matches what was confirmed.
  const updated = await db
    .update(users)
    .set({ emailVerifiedAt: new Date().toISOString().replace("T", " ").replace(/\..+$/, "") })
    .where(and(eq(users.id, tok.userId), eq(users.email, tok.email)))
    .returning({ id: users.id });
  if (updated.length === 0) {
    return c.json({ error: { code: "invalid_token", message: "Email no longer matches" } }, 400);
  }
  return c.json({ ok: true, verified: true });
});

// Public auth routes must be registered BEFORE mounting protectedRoutes —
// Hono's sub-app middleware (`use("*", requireAuth)`) intercepts any path
// added on the parent after the mount, including unauthenticated flows.
// Same reason /login and /guest are above protectedRoutes.

// Forgot-password kicks off the reset flow. Always returns 200 so we don't
// leak which (username, email) pairs map to real verified accounts. The
// actual send only happens for non-guest users with a verified email on file.
authRoutes.post("/forgot-password", async (c) => {
  const limited = await checkRateLimit(c.env.RL_EMAIL, emailIpKey(c));
  if (limited) return limited;
  const raw = await c.req.json().catch(() => ({}));
  const parsed = ForgotPasswordReq.safeParse(raw);
  if (!parsed.success) {
    // Even an invalid body returns 200 so that an attacker probing email
    // syntax can't distinguish it from a "no such account" miss.
    return c.json({ ok: true });
  }
  const email = parsed.data.email.trim().toLowerCase();
  const db = getDb(c.env.DB);
  const row = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      verifiedAt: users.emailVerifiedAt,
      isGuest: users.isGuest,
    })
    .from(users)
    .where(eq(users.email, email))
    .get();
  // Bail silently for any of: no row, guest account, unverified email, or
  // per-user cooldown active. Same response shape so a probing client can't
  // tell these apart.
  if (!row || row.isGuest === 1 || !row.email || !row.verifiedAt) {
    return c.json({ ok: true });
  }
  if (await isUserInCooldown(db, row.id)) {
    return c.json({ ok: true });
  }
  const token = await issueEmailToken(db, {
    userId: row.id,
    email: row.email,
    purpose: "reset",
    ttlSec: RESET_TOKEN_TTL_SEC,
  });
  await stampUserSent(db, row.id);
  await sendResetEmail(c.env, { to: row.email, username: row.name, token });
  return c.json({ ok: true });
});

// Submitted by the reset form. Token comes from the email link, password is
// the new value. Success rotates the hash and invalidates the token.
authRoutes.post("/reset-password", async (c) => {
  const limited = await checkRateLimit(c.env.RL_EMAIL, emailIpKey(c));
  if (limited) return limited;
  const rawBody = await c.req.json().catch(() => ({}));
  const parsed = ResetPasswordReq.safeParse(rawBody);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return c.json(
      { error: { code: "bad_request", message: first?.message ?? "Invalid body" } },
      400,
    );
  }
  const db = getDb(c.env.DB);
  const tok = await consumeEmailToken(db, parsed.data.token, "reset");
  if (!tok) {
    return c.json(
      { error: { code: "invalid_token", message: "Link expired or already used" } },
      400,
    );
  }
  // Belt-and-suspenders: also confirm the email on the row still matches the
  // token's snapshot, so a "change email + click old reset link" sequence
  // can't reset the wrong account.
  const user = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, tok.userId))
    .get();
  if (!user || user.email !== tok.email) {
    return c.json(
      { error: { code: "invalid_token", message: "Account state changed; request a new link" } },
      400,
    );
  }
  const hash = await hashPassword(parsed.data.password);
  await db.update(users).set({ passwordHash: hash }).where(eq(users.id, user.id)).run();
  return c.json({ ok: true });
});

authRoutes.route("/", protectedRoutes);
