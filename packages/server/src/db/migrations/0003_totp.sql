-- migration: 0003_totp
-- Optional TOTP (RFC 6238) second factor for non-guest accounts.
-- `totp_secret` stores the base32-encoded shared secret. `totp_enabled`
-- gates whether login enforces a code. A user can have a secret stored
-- (mid-setup) but not yet enabled; login only checks the enabled flag.

ALTER TABLE users ADD COLUMN totp_secret TEXT;
ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0;
