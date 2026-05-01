-- migration: 0007_email
-- Optional email on user accounts + flows for verification and password reset.
-- `email_verified_at` separates "address on file" from "address proven to belong
-- to user" — only verified addresses are valid recipients for password resets,
-- so an attacker can't claim a victim's email and silently swallow their reset.
-- `last_email_sent_at` is the per-user DB-level throttle (paired with the
-- RL_EMAIL rate limiter) so a single account can't burn through cost via
-- repeated "resend" / "forgot password" requests.

ALTER TABLE users ADD COLUMN email_verified_at TEXT;
ALTER TABLE users ADD COLUMN last_email_sent_at TEXT;

-- Tokens are stored as SHA-256 hex of the raw token sent in email links, so
-- a DB read alone never yields a usable link. `purpose` discriminates the two
-- flows; `consumed_at` makes single-use enforceable in a single UPDATE.
CREATE TABLE email_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  email TEXT NOT NULL,
  purpose TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_email_tokens_user ON email_tokens(user_id, purpose);
CREATE INDEX idx_email_tokens_expires ON email_tokens(expires_at);
