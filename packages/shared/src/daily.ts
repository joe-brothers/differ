// UTC date when daily #1 was first playable. Used to map any daily date to
// its sequence number (LinkedIn-game-style "#N" tag in share messages).
// Locked to the launch commit `affdbe2` "Add daily game" — do not edit; new
// dailies count up from here forever.
export const DAILY_EPOCH = "2026-04-26";

const DAY_MS = 24 * 60 * 60 * 1000;

// Sequence number for a given UTC date string ("YYYY-MM-DD"). Returns 1 for
// the epoch date, 2 for the day after, etc. Caller is expected to pass a
// well-formed UTC date key (see `utcDateKey` server-side); a malformed input
// yields NaN rather than a silently-wrong number.
export function dailyNumber(date: string): number {
  const epochMs = Date.parse(DAILY_EPOCH + "T00:00:00Z");
  const dateMs = Date.parse(date + "T00:00:00Z");
  return Math.floor((dateMs - epochMs) / DAY_MS) + 1;
}
