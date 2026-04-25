import type { Context } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";

export const TOKEN_COOKIE = "differ_token";
export const DEVICE_COOKIE = "differ_device_id";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days
const DEVICE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60; // 1 year

// Cross-origin (cookie omitted) safety net: many browsers reject SameSite=Lax
// cookies on cross-site fetches. We assume same-origin deploys (Vite proxy in
// dev, parent-domain in prod). When that ever stops being true, switch to
// SameSite=None+Secure here.
export function setTokenCookie(c: Context, token: string): void {
  setCookie(c, TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearTokenCookie(c: Context): void {
  deleteCookie(c, TOKEN_COOKIE, { path: "/" });
}

export function readTokenCookie(c: Context): string | undefined {
  return getCookie(c, TOKEN_COOKIE);
}

// Worker-level cookie reader for raw Request (used in WS upgrade path where
// we don't have a Hono Context anymore).
export function readTokenFromRequest(req: Request): string | null {
  const cookieHeader = req.headers.get("Cookie");
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === TOKEN_COOKIE) return rest.join("=");
  }
  return null;
}

// Device cookie: long-lived, survives logout. Used to re-bind a returning
// guest to their original guest user record so they don't accumulate
// throwaway accounts every time they log out.
export function setDeviceCookie(c: Context, deviceId: string): void {
  setCookie(c, DEVICE_COOKIE, deviceId, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: DEVICE_MAX_AGE_SECONDS,
  });
}

export function readDeviceCookie(c: Context): string | undefined {
  return getCookie(c, DEVICE_COOKIE);
}
