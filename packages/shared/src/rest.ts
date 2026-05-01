import { z } from "zod";
import { GameMode } from "./game.js";

export const PublicUser = z.object({
  userId: z.string(),
  name: z.string(),
  isGuest: z.boolean(),
});
export type PublicUser = z.infer<typeof PublicUser>;

// Token is delivered exclusively via httpOnly cookie (Set-Cookie) so it
// stays inaccessible to JS / XSS. The response body only echoes the public
// user info the client needs to render UI.
export const AuthRes = z.object({
  user: PublicUser,
});
export type AuthRes = z.infer<typeof AuthRes>;

// Daily-challenge state for the current user (today UTC). Bundled into
// /auth/me so the menu only needs one round trip on session start.
export const DailyState = z.object({
  date: z.string(),
  played: z.boolean(),
  result: z
    .object({
      elapsedMs: z.number().int().nonnegative().nullable(),
      foundCount: z.number().int().nonnegative(),
      outcome: z.string(),
      hintsUsed: z.number().int().nonnegative(),
    })
    .nullable(),
  streak: z.object({
    current: z.number().int().nonnegative(),
    longest: z.number().int().nonnegative(),
    lastDailyDate: z.string().nullable(),
  }),
});
export type DailyState = z.infer<typeof DailyState>;

// /auth/me extends AuthRes with stats the client surfaces in the menu.
// Kept separate so other endpoints don't have to compute the join.
export const MeRes = z.object({
  user: PublicUser,
  wins: z.number().int().nonnegative(),
  daily: DailyState,
});
export type MeRes = z.infer<typeof MeRes>;

// Per-user recent game history. The opponent slot is null for single-mode
// runs and for matches whose other participant has been deleted.
export const RecentGameOutcome = z.enum(["win", "loss", "timeout"]);
export type RecentGameOutcome = z.infer<typeof RecentGameOutcome>;

export const RecentGameOpponent = z.object({
  userId: z.string(),
  name: z.string(),
  outcome: RecentGameOutcome,
  elapsedMs: z.number().int().nonnegative().nullable(),
  foundCount: z.number().int().nonnegative(),
});
export type RecentGameOpponent = z.infer<typeof RecentGameOpponent>;

export const RecentGameEntry = z.object({
  gameId: z.string(),
  mode: GameMode,
  endedAt: z.string(),
  endReason: z.enum(["winner", "timeout"]),
  outcome: RecentGameOutcome,
  elapsedMs: z.number().int().nonnegative().nullable(),
  foundCount: z.number().int().nonnegative(),
  opponent: RecentGameOpponent.nullable(),
});
export type RecentGameEntry = z.infer<typeof RecentGameEntry>;

export const RecentGamesRes = z.object({
  games: z.array(RecentGameEntry),
});
export type RecentGamesRes = z.infer<typeof RecentGamesRes>;

export const GuestReq = z.object({}).optional();

// Password rules enforced both client-side (form validation) and server-side
// (post-parse). zxcvbn strength gate runs server-side only — see
// `packages/server/src/auth/password-policy.ts`.
export const PasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long")
  .regex(/[A-Za-z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one number");

// Username character set is intentionally narrow: letters, digits, and the
// punctuation `_ . -`. Excludes whitespace, `@`, slashes, quotes, and HTML
// metacharacters so a careless `innerHTML` later in the stack can't escalate
// a name into markup. Anything broader needs an explicit escaping audit.
export const UpgradeReq = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(32, "Username must be 32 characters or fewer")
    .regex(/^[A-Za-z0-9_.-]+$/, "Username can only contain letters, digits, and _ . -"),
  password: PasswordSchema,
});
export type UpgradeReq = z.infer<typeof UpgradeReq>;

export const LoginReq = z.object({
  username: z.string(),
  password: z.string(),
});
export type LoginReq = z.infer<typeof LoginReq>;

// When the account has TOTP enabled, /auth/login responds with this
// instead of setting a token cookie. The client then submits the code
// to /auth/login/totp along with the ticket.
export const LoginTotpRequiredRes = z.object({
  totpRequired: z.literal(true),
  ticket: z.string(),
});
export type LoginTotpRequiredRes = z.infer<typeof LoginTotpRequiredRes>;

export const LoginTotpReq = z.object({
  ticket: z.string(),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});
export type LoginTotpReq = z.infer<typeof LoginTotpReq>;

export const TotpStatusRes = z.object({ enabled: z.boolean() });
export type TotpStatusRes = z.infer<typeof TotpStatusRes>;

export const TotpSetupRes = z.object({
  secret: z.string(),
  otpauthUrl: z.string(),
});
export type TotpSetupRes = z.infer<typeof TotpSetupRes>;

export const TotpVerifyReq = z.object({
  code: z.string().regex(/^\d{6}$/),
});
export type TotpVerifyReq = z.infer<typeof TotpVerifyReq>;

export const TotpDisableReq = z.object({
  password: z.string(),
});
export type TotpDisableReq = z.infer<typeof TotpDisableReq>;

// Forgot-password kicks off the reset flow. Server responds 200 regardless
// of whether the account exists / has a verified email so we don't leak
// account presence; the actual email is dispatched only when both are true.
// Email is the only accepted lookup key — username lookup would let an
// attacker brute-force the username space to discover which accounts exist.
export const ForgotPasswordReq = z.object({
  email: z.string().email(),
});
export type ForgotPasswordReq = z.infer<typeof ForgotPasswordReq>;

// Submitted by the reset form rendered when the user follows the link from
// the password-reset email. Token is the raw value from the URL.
export const ResetPasswordReq = z.object({
  token: z.string().min(8),
  password: PasswordSchema,
});
export type ResetPasswordReq = z.infer<typeof ResetPasswordReq>;

export const VerifyEmailReq = z.object({
  token: z.string().min(8),
});
export type VerifyEmailReq = z.infer<typeof VerifyEmailReq>;

export const SetEmailReq = z.object({
  email: z.string().email(),
});
export type SetEmailReq = z.infer<typeof SetEmailReq>;

export const EmailStatusRes = z.object({
  email: z.string().nullable(),
  verified: z.boolean(),
  // Server-side cooldown remaining in seconds (0 when ready to resend).
  // Client uses this to render a disabled "Resend" button with a countdown.
  resendCooldownSec: z.number().int().nonnegative(),
});
export type EmailStatusRes = z.infer<typeof EmailStatusRes>;

export const CreateRoomReq = z.object({
  mode: GameMode,
});
export type CreateRoomReq = z.infer<typeof CreateRoomReq>;

export const CreateRoomRes = z.object({
  roomCode: z.string(),
  wsUrl: z.string(),
});
export type CreateRoomRes = z.infer<typeof CreateRoomRes>;

export const JoinRoomRes = z.object({
  roomCode: z.string(),
  wsUrl: z.string(),
});
export type JoinRoomRes = z.infer<typeof JoinRoomRes>;

export const LeaderboardQuery = z.object({
  mode: GameMode.default("single"),
  // For mode='daily', the UTC date (YYYY-MM-DD) being viewed. Optional —
  // server falls back to today UTC. Ignored for non-daily modes.
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type LeaderboardQuery = z.infer<typeof LeaderboardQuery>;

export const LeaderboardEntry = z.object({
  rank: z.number(),
  userId: z.string(),
  name: z.string(),
  wins: z.number(),
  bestMs: z.number().nullable(),
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntry>;

export const LeaderboardRes = z.object({
  entries: z.array(LeaderboardEntry),
});
export type LeaderboardRes = z.infer<typeof LeaderboardRes>;

// Daily result summary — small payload computed live from the same eligibility
// rules as the leaderboard (mode='daily', outcome='win', hintsUsed=0,
// non-guest). Bucket is the smallest LinkedIn-style band the user fits, gated
// by sample size so "top 1%" needs ≥100 players, "top 5%" ≥20, etc.
export const PercentileBucket = z.enum(["top1", "top5", "top10", "top25", "top50"]);
export type PercentileBucket = z.infer<typeof PercentileBucket>;

export const DailySummaryQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type DailySummaryQuery = z.infer<typeof DailySummaryQuery>;

export const DailySummaryRes = z.object({
  date: z.string(),
  totalPlayers: z.number().int().nonnegative(),
  leaderMs: z.number().int().nonnegative().nullable(),
  yourMs: z.number().int().nonnegative().nullable(),
  yourRank: z.number().int().positive().nullable(),
  bucket: PercentileBucket.nullable(),
});
export type DailySummaryRes = z.infer<typeof DailySummaryRes>;

export const ErrorRes = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type ErrorRes = z.infer<typeof ErrorRes>;
