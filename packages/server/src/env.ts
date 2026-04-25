export interface Env {
  DB: D1Database;
  GAME_ROOM: DurableObjectNamespace;

  JWT_SECRET: string; // secret, set via `wrangler secret put`
  JWT_ISSUER: string;
  CDN_BASE: string;
}

export interface JwtClaims {
  sub: string; // user id
  name: string;
  isGuest: boolean;
  iat: number;
  exp: number;
  iss: string;
}
