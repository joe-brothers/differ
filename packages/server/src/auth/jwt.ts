import { sign, verify, decode } from "@tsndr/cloudflare-worker-jwt";
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
  return sign(claims, secret);
}

export async function verifyToken(secret: string, token: string): Promise<JwtClaims | null> {
  try {
    const ok = await verify(token, secret);
    if (!ok) return null;
    const decoded = decode<JwtClaims>(token);
    return decoded.payload ?? null;
  } catch {
    return null;
  }
}

// Short-lived ticket used between the password-OK step and the TOTP-OK step
// of login. Encodes only the userId; verifying the code is a separate step.
const TOTP_TICKET_TTL_SEC = 5 * 60;

interface TotpTicketClaims {
  sub: string;
  purpose: "totp_pending";
  iat: number;
  exp: number;
  iss: string;
}

export async function signTotpTicket(
  secret: string,
  issuer: string,
  userId: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims: TotpTicketClaims = {
    sub: userId,
    purpose: "totp_pending",
    iat: now,
    exp: now + TOTP_TICKET_TTL_SEC,
    iss: issuer,
  };
  return sign(claims, secret);
}

export async function verifyTotpTicket(secret: string, token: string): Promise<string | null> {
  try {
    const ok = await verify(token, secret);
    if (!ok) return null;
    const decoded = decode<TotpTicketClaims>(token);
    const claims = decoded.payload;
    if (!claims || claims.purpose !== "totp_pending") return null;
    return claims.sub;
  } catch {
    return null;
  }
}
