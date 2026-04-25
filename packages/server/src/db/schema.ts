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

export const gameResults = sqliteTable(
  "game_results",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    roomCode: text("room_code"),
    mode: text("mode").notNull(),
    elapsedMs: integer("elapsed_ms").notNull(),
    completedAt: text("completed_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    lbIdx: index("idx_game_results_lb").on(t.mode, t.elapsedMs),
    userIdx: index("idx_game_results_user").on(t.userId),
  }),
);
