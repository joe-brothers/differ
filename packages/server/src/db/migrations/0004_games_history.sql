-- migration: 0004_games_history
-- Replace winner-only `game_results` with a richer two-table model:
--   games               – one row per match (game-level facts)
--   game_participants   – one row per (game, user) (per-player outcome)
-- Captures losers, timeouts, and end-reason so we can drive recent-games
-- views, accurate win/loss stats, and analytics. The old `game_results`
-- rows are backfilled as winner-only entries (loser data is unrecoverable).

CREATE TABLE games (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  room_code TEXT,
  started_at TEXT,
  ended_at TEXT NOT NULL DEFAULT (datetime('now')),
  end_reason TEXT NOT NULL,
  winner_id TEXT REFERENCES users(id)
);
CREATE INDEX idx_games_ended_at ON games(ended_at);
CREATE INDEX idx_games_mode_ended ON games(mode, ended_at);

CREATE TABLE game_participants (
  game_id TEXT NOT NULL REFERENCES games(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  mode TEXT NOT NULL,
  outcome TEXT NOT NULL,
  elapsed_ms INTEGER,
  found_count INTEGER NOT NULL DEFAULT 0,
  ended_at TEXT NOT NULL,
  PRIMARY KEY (game_id, user_id)
);
CREATE INDEX idx_gp_user_ended ON game_participants(user_id, ended_at);
CREATE INDEX idx_gp_mode_outcome ON game_participants(mode, outcome);
CREATE INDEX idx_gp_mode_elapsed ON game_participants(mode, elapsed_ms);

-- Backfill: every existing game_results row was a win.
INSERT INTO games (id, mode, room_code, started_at, ended_at, end_reason, winner_id)
SELECT id, mode, room_code, NULL, completed_at, 'winner', user_id
FROM game_results;

INSERT INTO game_participants
  (game_id, user_id, mode, outcome, elapsed_ms, found_count, ended_at)
SELECT id, user_id, mode, 'win', elapsed_ms, 0, completed_at
FROM game_results;

DROP INDEX idx_game_results_lb;
DROP INDEX idx_game_results_user;
DROP TABLE game_results;
