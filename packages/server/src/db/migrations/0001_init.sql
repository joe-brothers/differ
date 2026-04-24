-- migration: 0001_init

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT UNIQUE,
  password_hash TEXT,
  email TEXT UNIQUE,
  is_guest INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_users_username ON users(username);

CREATE TABLE puzzles (
  id TEXT PRIMARY KEY,
  differences TEXT NOT NULL,
  path TEXT NOT NULL,
  extension TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE game_results (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  room_code TEXT,
  mode TEXT NOT NULL,
  elapsed_ms INTEGER NOT NULL,
  completed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_game_results_lb ON game_results(mode, elapsed_ms);
CREATE INDEX idx_game_results_user ON game_results(user_id);
