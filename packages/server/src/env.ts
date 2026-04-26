export interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  DB: D1Database;
  GAME_ROOM: DurableObjectNamespace;
  MATCHMAKING_QUEUE: DurableObjectNamespace;

  RL_LOGIN: RateLimit;
  RL_GUEST: RateLimit;
  RL_UPGRADE: RateLimit;
  RL_ROOM: RateLimit;

  JWT_SECRET: string; // secret, set via `wrangler secret put`
  JWT_ISSUER: string;
  CDN_BASE: string;
  ALLOWED_ORIGINS: string; // comma-separated; empty = allow any (dev)
  TURNSTILE_SECRET: string; // empty = disabled (dev)
}

export interface JwtClaims {
  sub: string; // user id
  name: string;
  isGuest: boolean;
  iat: number;
  exp: number;
  iss: string;
}
