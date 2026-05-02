-- migration: 0008_username_lowercase
-- Existing rows audited: no two usernames collide when lowercased, so a
-- straight UPDATE is safe. `name` (display) is left untouched.

UPDATE users
SET username = LOWER(username)
WHERE username IS NOT NULL AND username <> LOWER(username);
