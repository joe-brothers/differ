import type { Context, Next } from "hono";
import type { Env, JwtClaims } from "../env.js";
import { verifyToken } from "./jwt.js";

export type AuthEnv = { Bindings: Env; Variables: { user: JwtClaims } };

export async function requireAuth(c: Context<AuthEnv>, next: Next) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: { code: "unauthenticated", message: "Missing bearer token" } }, 401);
  }
  const token = header.slice("Bearer ".length);
  const claims = await verifyToken(c.env.JWT_SECRET, token);
  if (!claims) {
    return c.json({ error: { code: "unauthenticated", message: "Invalid token" } }, 401);
  }
  c.set("user", claims);
  await next();
}
