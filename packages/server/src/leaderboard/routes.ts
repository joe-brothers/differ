import { Hono } from 'hono';
import { LeaderboardQuery, type LeaderboardRes } from '@differ/shared';
import type { Env } from '../env.js';

export const leaderboardRoutes = new Hono<{ Bindings: Env }>();

// A row in `game_results` represents a win (losers are never inserted), so
// the leaderboard is a simple COUNT aggregation keyed by mode.
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
    `SELECT u.id AS user_id,
            u.name AS name,
            COUNT(*) AS wins,
            MIN(gr.elapsed_ms) AS best_ms
     FROM game_results gr JOIN users u ON u.id = gr.user_id
     WHERE gr.mode = ?
     GROUP BY u.id, u.name
     ORDER BY wins DESC, best_ms ASC
     LIMIT ? OFFSET ?`,
  ).bind(mode, limit, offset).all<{
    user_id: string; name: string; wins: number; best_ms: number | null;
  }>();

  const body: LeaderboardRes = {
    entries: results.map((r, i) => ({
      rank: offset + i + 1,
      userId: r.user_id,
      name: r.name,
      wins: r.wins,
      bestMs: r.best_ms,
    })),
  };
  return c.json(body);
});
