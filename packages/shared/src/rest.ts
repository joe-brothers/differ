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

export const GuestReq = z.object({}).optional();

export const UpgradeReq = z.object({
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9_]+$/),
  password: z.string().min(6).max(128),
});
export type UpgradeReq = z.infer<typeof UpgradeReq>;

export const LoginReq = z.object({
  username: z.string(),
  password: z.string(),
});
export type LoginReq = z.infer<typeof LoginReq>;

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
