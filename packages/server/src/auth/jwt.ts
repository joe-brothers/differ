import jwt from "@tsndr/cloudflare-worker-jwt";
import type { JwtClaims } from "../env.js";

const TOKEN_TTL_SEC = 60 * 60 * 24 * 30; // 30 days

export async function signToken(
  secret: string,
  issuer: string,
  payload: { userId: string; name: string; isGuest: boolean },
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims: JwtClaims = {
    sub: payload.userId,
    name: payload.name,
    isGuest: payload.isGuest,
    iat: now,
    exp: now + TOKEN_TTL_SEC,
    iss: issuer,
  };
  return jwt.sign(claims, secret);
}

export async function verifyToken(secret: string, token: string): Promise<JwtClaims | null> {
  try {
    const ok = await jwt.verify(token, secret);
    if (!ok) return null;
    const decoded = jwt.decode<JwtClaims>(token);
    return decoded.payload ?? null;
  } catch {
    return null;
  }
}
