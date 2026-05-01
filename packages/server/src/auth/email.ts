import { and, eq, gt, isNull, lt } from "drizzle-orm";
import type { DB } from "../db/client.js";
import { emailTokens, users } from "../db/schema.js";
import type { Env } from "../env.js";

// Per-user cooldown between any two outbound emails. Pairs with the per-IP
// RL_EMAIL rate limiter — RL guards anonymous floods, this guards a single
// authenticated user (or a known username on /forgot-password) from being
// used as a delivery weapon against an inbox.
export const EMAIL_USER_COOLDOWN_SEC = 60;

// Token TTLs. Both flows use a tight 30-minute window: verification doesn't
// need to be generous (we always offer "Resend") and reset is short because
// a stolen token grants the account.
export const VERIFY_TOKEN_TTL_SEC = 30 * 60;
export const RESET_TOKEN_TTL_SEC = 30 * 60;

export type EmailPurpose = "verify" | "reset";

// Raw token in the URL is opaque base64url; only its SHA-256 lives in DB.
// generateToken returns both so the caller can mail the raw and store the hash.
export async function generateToken(): Promise<{ raw: string; hash: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = base64url(bytes);
  const hash = await sha256Hex(raw);
  return { raw, hash };
}

export async function hashToken(raw: string): Promise<string> {
  return sha256Hex(raw);
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function base64url(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// SQLite datetime('now') is "YYYY-MM-DD HH:MM:SS" (UTC, no zone suffix).
// Convert to ISO-8601 + 'Z' before parsing so V8 doesn't fall back to local
// time interpretation on environments without lenient parsing.
export function parseSqliteUtc(s: string | null): number | null {
  if (!s) return null;
  const ms = Date.parse(`${s.replace(" ", "T")}Z`);
  return Number.isFinite(ms) ? ms : null;
}

// Returns `true` if the user is still inside the per-user cooldown. Caller
// short-circuits with a generic "check your inbox" response so we don't leak
// timing about which accounts exist.
export async function isUserInCooldown(db: DB, userId: string): Promise<boolean> {
  const row = await db
    .select({ lastEmailSentAt: users.lastEmailSentAt })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  const last = parseSqliteUtc(row?.lastEmailSentAt ?? null);
  if (last === null) return false;
  return Date.now() - last < EMAIL_USER_COOLDOWN_SEC * 1000;
}

// Stamp the cooldown atomically with sending. We update first; if the send
// itself fails, the user waits the cooldown to retry — a tradeoff in favor of
// not paying for repeated attempts during a transient transport outage.
export async function stampUserSent(db: DB, userId: string): Promise<void> {
  await db.update(users).set({ lastEmailSentAt: nowIso() }).where(eq(users.id, userId)).run();
}

export function nowIso(): string {
  return new Date().toISOString().replace("T", " ").replace(/\..+$/, "");
}

function expiresIn(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString().replace("T", " ").replace(/\..+$/, "");
}

// Issues a fresh token of `purpose` for the user, invalidating any prior
// unconsumed tokens of the same purpose so multiple "resend" clicks can't
// leave a trail of valid links. Returns the RAW token for embedding in mail.
export async function issueEmailToken(
  db: DB,
  args: { userId: string; email: string; purpose: EmailPurpose; ttlSec: number },
): Promise<string> {
  await db
    .update(emailTokens)
    .set({ consumedAt: nowIso() })
    .where(
      and(
        eq(emailTokens.userId, args.userId),
        eq(emailTokens.purpose, args.purpose),
        isNull(emailTokens.consumedAt),
      ),
    )
    .run();

  const { raw, hash } = await generateToken();
  await db
    .insert(emailTokens)
    .values({
      tokenHash: hash,
      userId: args.userId,
      email: args.email,
      purpose: args.purpose,
      expiresAt: expiresIn(args.ttlSec),
    })
    .run();
  return raw;
}

// Resolves a raw token to its row IF it is for `purpose`, unconsumed, and
// not expired. Returns null otherwise — caller responds generically.
export async function consumeEmailToken(
  db: DB,
  raw: string,
  purpose: EmailPurpose,
): Promise<{ userId: string; email: string } | null> {
  const hash = await hashToken(raw);
  const now = nowIso();
  const row = await db
    .select({
      tokenHash: emailTokens.tokenHash,
      userId: emailTokens.userId,
      email: emailTokens.email,
    })
    .from(emailTokens)
    .where(
      and(
        eq(emailTokens.tokenHash, hash),
        eq(emailTokens.purpose, purpose),
        isNull(emailTokens.consumedAt),
        gt(emailTokens.expiresAt, now),
      ),
    )
    .get();
  if (!row) return null;
  // Mark consumed atomically: the `consumed_at IS NULL` predicate makes a
  // double-click race produce 0 rows on the second click instead of two
  // password resets sharing one token.
  const updated = await db
    .update(emailTokens)
    .set({ consumedAt: now })
    .where(and(eq(emailTokens.tokenHash, hash), isNull(emailTokens.consumedAt)))
    .returning({ tokenHash: emailTokens.tokenHash });
  if (updated.length === 0) return null;
  return { userId: row.userId, email: row.email };
}

// Garbage-collect old consumed/expired token rows. Best-effort — called from
// the daily cron handler so the table doesn't grow unbounded.
export async function pruneEmailTokens(db: DB): Promise<void> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace("T", " ")
    .replace(/\..+$/, "");
  await db.delete(emailTokens).where(lt(emailTokens.expiresAt, cutoff)).run();
}

// --- transport ---------------------------------------------------------

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
}

async function send(env: Env, msg: SendArgs): Promise<void> {
  // `wrangler dev` simulates the send_email binding by writing each message
  // to a temp file and printing the path — no real network call, no DKIM
  // setup needed. So we don't need a separate dev path here.
  await env.EMAIL.send({
    from: { email: env.MAIL_FROM, name: env.MAIL_FROM_NAME || "Differ" },
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function verifyUrl(env: Env, token: string): string {
  const base = (env.APP_URL || "").replace(/\/+$/, "") || "https://differ.joe-brothers.com";
  return `${base}/?action=verify-email&token=${encodeURIComponent(token)}`;
}

function resetUrl(env: Env, token: string): string {
  const base = (env.APP_URL || "").replace(/\/+$/, "") || "https://differ.joe-brothers.com";
  return `${base}/?action=reset-password&token=${encodeURIComponent(token)}`;
}

export async function sendVerificationEmail(
  env: Env,
  args: { to: string; username: string; token: string },
): Promise<void> {
  const url = verifyUrl(env, args.token);
  const safeName = escapeHtml(args.username);
  const safeUrl = escapeHtml(url);
  const subject = "Verify your Differ email";
  const text = [
    `Hi ${args.username},`,
    "",
    "Confirm this email address for your Differ account by opening the link below:",
    url,
    "",
    "This link expires in 30 minutes. If you didn't request this, ignore this email.",
  ].join("\n");
  const html = [
    `<p>Hi ${safeName},</p>`,
    "<p>Confirm this email address for your Differ account:</p>",
    `<p><a href="${safeUrl}">Verify email</a></p>`,
    `<p style="font-size:12px;color:#888">Or paste this URL into your browser:<br>${safeUrl}</p>`,
    '<p style="font-size:12px;color:#888">This link expires in 30 minutes. If you didn\'t request this, ignore this email.</p>',
  ].join("");
  await send(env, { to: args.to, subject, html, text });
}

export async function sendResetEmail(
  env: Env,
  args: { to: string; username: string; token: string },
): Promise<void> {
  const url = resetUrl(env, args.token);
  const safeName = escapeHtml(args.username);
  const safeUrl = escapeHtml(url);
  const subject = "Reset your Differ password";
  const text = [
    `Hi ${args.username},`,
    "",
    "Reset your Differ password by opening the link below:",
    url,
    "",
    "This link expires in 30 minutes. If you didn't request a reset, ignore this email — your password stays the same.",
  ].join("\n");
  const html = [
    `<p>Hi ${safeName},</p>`,
    "<p>Reset your Differ password:</p>",
    `<p><a href="${safeUrl}">Reset password</a></p>`,
    `<p style="font-size:12px;color:#888">Or paste this URL into your browser:<br>${safeUrl}</p>`,
    '<p style="font-size:12px;color:#888">This link expires in 30 minutes. If you didn\'t request a reset, ignore this email — your password stays the same.</p>',
  ].join("");
  await send(env, { to: args.to, subject, html, text });
}
