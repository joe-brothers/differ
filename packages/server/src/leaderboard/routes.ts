import { Hono } from 'hono';
import { LeaderboardQuery, type LeaderboardRes } from '@differ/shared';
import type { Env } from '../env.js';

export const leaderboardRoutes = new Hono<{ Bindings: Env }>();

leaderboardRoutes.get('/', async (c) => {
  const parsed = LeaderboardQuery.safeParse({
    mode: c.req.query('mode'),
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  });
  if (!parsed.success) {
    return c.json({ error: { code: 'bad_request', message: parsed.error.message } }, 400);
  }
  const { mode, limit, offset } = parsed.data;

  const { results } = await c.env.DB.prepare(
    `SELECT u.id AS user_id, u.name AS name, gr.elapsed_ms AS elapsed_ms, gr.completed_at AS completed_at
     FROM game_results gr JOIN users u ON u.id = gr.user_id
     WHERE gr.mode = ?
     ORDER BY gr.elapsed_ms ASC
     LIMIT ? OFFSET ?`,
  ).bind(mode, limit, offset).all<{
    user_id: string; name: string; elapsed_ms: number; completed_at: string;
  }>();

  const body: LeaderboardRes = {
    entries: results.map((r, i) => ({
      rank: offset + i + 1,
      userId: r.user_id,
      name: r.name,
      elapsedMs: r.elapsed_ms,
      completedAt: r.completed_at,
    })),
  };
  return c.json(body);
});
