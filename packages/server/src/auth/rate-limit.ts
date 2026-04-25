import type { Context } from "hono";
import type { RateLimit } from "../env.js";

// Local dev / non-CF requests have no real client IP. Falling back to a
// constant means everyone shares the same bucket in dev — fine, since the
// goal is to exercise the path, not to actually throttle developers.
function clientIp(c: Context): string {
  return c.req.header("cf-connecting-ip") ?? "local";
}

export async function checkRateLimit(limiter: RateLimit, key: string): Promise<Response | null> {
  const { success } = await limiter.limit({ key });
  if (success) return null;
  return new Response(
    JSON.stringify({
      error: { code: "rate_limited", message: "Too many requests, slow down" },
    }),
    {
      status: 429,
      headers: { "content-type": "application/json", "retry-after": "60" },
    },
  );
}

export function loginKey(c: Context, username: string): string {
  return `login:${clientIp(c)}:${username.toLowerCase()}`;
}

export function guestKey(c: Context): string {
  return `guest:${clientIp(c)}`;
}

export function upgradeKey(c: Context, userId: string): string {
  return `upgrade:${clientIp(c)}:${userId}`;
}
