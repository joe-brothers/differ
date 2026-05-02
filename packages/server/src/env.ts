export interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

// Cloudflare Email Service binding (`send_email` in wrangler.toml). Native
// type from @cloudflare/workers-types is `SendEmail`, but its surface differs
// across Workers runtimes (legacy Email Routing vs. Email Sending public
// beta). We declare the slice we actually use so the worker compiles against
// the runtime present at deploy time.
export interface EmailBinding {
  send(message: {
    from: string | { email: string; name: string };
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    replyTo?: string | { email: string; name: string };
    headers?: Record<string, string>;
  }): Promise<{ messageId: string }>;
}

export interface Env {
  DB: D1Database;
  GAME_ROOM: DurableObjectNamespace;
  MATCHMAKING_QUEUE: DurableObjectNamespace;

  RL_LOGIN: RateLimit;
  RL_GUEST: RateLimit;
  RL_UPGRADE: RateLimit;
  RL_ROOM: RateLimit;
  // Per-IP cap on outbound-mail-triggering routes (set-email, resend,
  // forgot-password). Paired with users.last_email_sent_at for per-user gating.
  RL_EMAIL: RateLimit;
  RL_TOTP: RateLimit;

  // Cloudflare Email Service binding. `wrangler dev` simulates this by
  // writing each message to a temp file (so no DKIM setup needed locally);
  // prod hits the real Email Service. Wrangler validates the binding at
  // deploy time, so it's always present at runtime.
  EMAIL: EmailBinding;

  JWT_SECRET: string; // secret, set via `wrangler secret put`
  JWT_ISSUER: string;
  CDN_BASE: string;
  ALLOWED_ORIGINS: string; // comma-separated; empty = allow any (dev)
  TURNSTILE_SECRET: string; // empty = disabled (dev)

  // From-address for outbound mail. Must belong to a domain onboarded to
  // Cloudflare Email Service (DKIM + SPF). For local dev any address on the
  // onboarded domain works since wrangler simulates the send.
  MAIL_FROM: string;
  MAIL_FROM_NAME: string;
  // Public URL of the SPA. Used to build links inside emails (verification,
  // password reset). The client recognizes `?action=verify-email&token=...`
  // and `?action=reset-password&token=...` query params at boot.
  APP_URL: string;
}

export interface JwtClaims {
  sub: string; // user id
  name: string;
  isGuest: boolean;
  iat: number;
  exp: number;
  iss: string;
}
