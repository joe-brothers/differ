import { Hono } from 'hono';
import { LoginReq, UpgradeReq, AuthRes } from '@differ/shared';
import type { Env } from '../env.js';
import { signToken } from './jwt.js';
import { hashPassword, verifyPassword } from './password.js';
import { requireAuth, type AuthEnv } from './middleware.js';

export const authRoutes = new Hono<{ Bindings: Env }>();

function randomGuestName(): string {
  const n = Math.floor(Math.random() * 9000 + 1000);
  return `Guest#${n}`;
}

function genUserId(): string {
  return crypto.randomUUID();
}

authRoutes.post('/guest', async (c) => {
  const userId = genUserId();
  const name = randomGuestName();
  await c.env.DB.prepare(
    `INSERT INTO users (id, name, is_guest) VALUES (?, ?, 1)`,
  ).bind(userId, name).run();
  const token = await signToken(c.env.JWT_SECRET, c.env.JWT_ISSUER, { userId, name, isGuest: true });
  const body: AuthRes = { token, user: { userId, name, isGuest: true } };
  return c.json(body);
});

authRoutes.post('/login', async (c) => {
  const raw = await c.req.json().catch(() => ({}));
  const parsed = LoginReq.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: { code: 'bad_request', message: 'Invalid body' } }, 400);
  }
  const { username, password } = parsed.data;
  const row = await c.env.DB.prepare(
    `SELECT id, name, password_hash, is_guest FROM users WHERE username = ?`,
  ).bind(username).first<{ id: string; name: string; password_hash: string | null; is_guest: number }>();
  if (!row || !row.password_hash) {
    return c.json({ error: { code: 'invalid_credentials', message: 'Invalid credentials' } }, 401);
  }
  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) {
    return c.json({ error: { code: 'invalid_credentials', message: 'Invalid credentials' } }, 401);
  }
  const token = await signToken(c.env.JWT_SECRET, c.env.JWT_ISSUER, {
    userId: row.id,
    name: row.name,
    isGuest: false,
  });
  const body: AuthRes = { token, user: { userId: row.id, name: row.name, isGuest: false } };
  return c.json(body);
});

const protectedRoutes = new Hono<AuthEnv>();
protectedRoutes.use('*', requireAuth);

protectedRoutes.get('/me', async (c) => {
  const claims = c.get('user');
  const row = await c.env.DB.prepare(
    `SELECT id, name, is_guest FROM users WHERE id = ?`,
  ).bind(claims.sub).first<{ id: string; name: string; is_guest: number }>();
  if (!row) {
    return c.json({ error: { code: 'not_found', message: 'User gone' } }, 404);
  }
  return c.json({ user: { userId: row.id, name: row.name, isGuest: row.is_guest === 1 } });
});

protectedRoutes.post('/upgrade', async (c) => {
  const claims = c.get('user');
  if (!claims.isGuest) {
    return c.json({ error: { code: 'already_registered', message: 'Account already has credentials' } }, 409);
  }
  const raw = await c.req.json().catch(() => ({}));
  const parsed = UpgradeReq.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: { code: 'bad_request', message: parsed.error.message } }, 400);
  }
  const { username, password } = parsed.data;

  const existing = await c.env.DB.prepare(
    `SELECT id FROM users WHERE username = ?`,
  ).bind(username).first<{ id: string }>();
  if (existing) {
    return c.json({ error: { code: 'username_taken', message: 'Username already taken' } }, 409);
  }

  const hash = await hashPassword(password);
  const result = await c.env.DB.prepare(
    `UPDATE users SET username = ?, password_hash = ?, name = ?, is_guest = 0 WHERE id = ? AND is_guest = 1`,
  ).bind(username, hash, username, claims.sub).run();

  if (!result.success || result.meta.changes === 0) {
    return c.json({ error: { code: 'conflict', message: 'Upgrade failed' } }, 409);
  }

  const token = await signToken(c.env.JWT_SECRET, c.env.JWT_ISSUER, {
    userId: claims.sub,
    name: username,
    isGuest: false,
  });
  const body: AuthRes = { token, user: { userId: claims.sub, name: username, isGuest: false } };
  return c.json(body);
});

authRoutes.route('/', protectedRoutes);
