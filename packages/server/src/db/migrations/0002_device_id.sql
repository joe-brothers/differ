-- migration: 0002_device_id
-- Persistent device identifier so a guest who logs out and clicks "Continue
-- as Guest" again gets re-bound to their existing guest user instead of
-- creating yet another disposable account.

ALTER TABLE users ADD COLUMN device_id TEXT;
CREATE INDEX idx_users_device_id ON users(device_id);
