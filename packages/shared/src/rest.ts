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

// /auth/me extends AuthRes with stats the client surfaces in the menu.
// Kept separate so other endpoints don't have to compute the join.
export const MeRes = z.object({
  user: PublicUser,
  wins: z.number().int().nonnegative(),
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

export const UpgradeReq = z.object({
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9_]+$/),
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

// Mockup-only password reset request (no email is actually sent yet).
export const ForgotPasswordReq = z.object({
  username: z.string().optional(),
  email: z.string().email().optional(),
});
export type ForgotPasswordReq = z.infer<typeof ForgotPasswordReq>;

export const SetEmailReq = z.object({
  email: z.string().email(),
});
export type SetEmailReq = z.infer<typeof SetEmailReq>;

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

export const ErrorRes = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type ErrorRes = z.infer<typeof ErrorRes>;
