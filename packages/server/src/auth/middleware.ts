import type { Context, Next } from "hono";
import type { Env, JwtClaims } from "../env.js";
import { verifyToken } from "./jwt.js";
import { readTokenCookie } from "./cookie.js";

export type AuthEnv = { Bindings: Env; Variables: { user: JwtClaims } };

export async function requireAuth(c: Context<AuthEnv>, next: Next) {
  // Prefer cookie (httpOnly, XSS-safe). Authorization header is kept as a
  // fallback so non-browser clients (curl, server-to-server) still work.
  let token = readTokenCookie(c);
  if (!token) {
    const header = c.req.header("Authorization");
    if (header?.startsWith("Bearer ")) token = header.slice("Bearer ".length);
  }
  if (!token) {
    return c.json({ error: { code: "unauthenticated", message: "Missing token" } }, 401);
  }
  const claims = await verifyToken(c.env.JWT_SECRET, token);
  if (!claims) {
    return c.json({ error: { code: "unauthenticated", message: "Invalid token" } }, 401);
  }
  c.set("user", claims);
  await next();
}
