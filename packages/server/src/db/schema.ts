import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    username: text("username").unique(),
    passwordHash: text("password_hash"),
    email: text("email").unique(),
    isGuest: integer("is_guest").notNull().default(1),
    deviceId: text("device_id"),
    totpSecret: text("totp_secret"),
    totpEnabled: integer("totp_enabled").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    usernameIdx: index("idx_users_username").on(t.username),
    deviceIdx: index("idx_users_device_id").on(t.deviceId),
  }),
);

export const puzzles = sqliteTable("puzzles", {
  id: text("id").primaryKey(),
  differences: text("differences").notNull(),
  path: text("path").notNull(),
  extension: text("extension").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// One row per match. Captures end-reason so timeouts and legitimate wins
// can be distinguished by analytics without re-deriving from outcomes.
export const games = sqliteTable(
  "games",
  {
    id: text("id").primaryKey(),
    mode: text("mode").notNull(),
    roomCode: text("room_code"),
    startedAt: text("started_at"),
    endedAt: text("ended_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    endReason: text("end_reason").notNull(),
    winnerId: text("winner_id").references(() => users.id),
  },
  (t) => ({
    endedIdx: index("idx_games_ended_at").on(t.endedAt),
    modeEndedIdx: index("idx_games_mode_ended").on(t.mode, t.endedAt),
  }),
);

// One row per player per match. `outcome='win'` is the leaderboard signal —
// timeout-winners are marked 'timeout' so they don't earn leaderboard credit
// (matches the prior winner-only behavior).
export const gameParticipants = sqliteTable(
  "game_participants",
  {
    gameId: text("game_id")
      .notNull()
      .references(() => games.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    mode: text("mode").notNull(),
    outcome: text("outcome").notNull(),
    elapsedMs: integer("elapsed_ms"),
    foundCount: integer("found_count").notNull().default(0),
    endedAt: text("ended_at").notNull(),
  },
  (t) => ({
    userIdx: index("idx_gp_user_ended").on(t.userId, t.endedAt),
    modeOutcomeIdx: index("idx_gp_mode_outcome").on(t.mode, t.outcome),
    modeElapsedIdx: index("idx_gp_mode_elapsed").on(t.mode, t.elapsedMs),
  }),
);
