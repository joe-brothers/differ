-- migration: 0005_daily
-- Daily Challenge: one fixed puzzle set per UTC date, one attempt per user.
--   daily_puzzles    – the day's fixed 5-puzzle set (cron-built, lazy fallback)
--   daily_attempts   – enforces "one play per user per day" (D2-(a))
--                      user_stats.last_daily_date / streak read from here too

CREATE TABLE daily_puzzles (
  date TEXT PRIMARY KEY,
  puzzle_set TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE daily_attempts (
  user_id TEXT NOT NULL REFERENCES users(id),
  date TEXT NOT NULL,
  game_id TEXT NOT NULL REFERENCES games(id),
  PRIMARY KEY (user_id, date)
);
CREATE INDEX idx_daily_attempts_date ON daily_attempts(date, user_id);

-- Streak / daily activity counters. Lazy-updated on each daily completion;
-- no cron sweep needed since reset is implied by `last_daily_date < yesterday`.
CREATE TABLE user_stats (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_daily_date TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
