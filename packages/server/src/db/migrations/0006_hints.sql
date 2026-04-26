-- migration: 0006_hints
-- Daily Challenge hints: one button, 10s cooldown. Using a hint keeps the
-- streak (recorded as a 'win' via the normal game-end path) but excludes the
-- attempt from the daily leaderboard. `hints_used > 0` is the leaderboard
-- exclusion signal — the share card calls 0 a "Flawless" run.

ALTER TABLE game_participants ADD COLUMN hints_used INTEGER NOT NULL DEFAULT 0;
