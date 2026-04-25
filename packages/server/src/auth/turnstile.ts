// Cloudflare Turnstile server-side verification.
//
// Activation: set TURNSTILE_SECRET (via `wrangler secret put`). When unset,
// verification is a no-op so local development works without a real key.
// The client must POST { turnstileToken } in the auth request bodies; the
// widget integration on the web client is a separate piece of work.
//
// Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileVerification {
  ok: boolean;
  errorCodes?: string[];
}

export async function verifyTurnstile(
  secret: string,
  token: string | undefined,
  remoteIp: string | undefined,
): Promise<TurnstileVerification> {
  // Empty secret = feature disabled (dev). Allow through.
  if (!secret) return { ok: true };
  if (!token) return { ok: false, errorCodes: ["missing-token"] };

  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (remoteIp) form.append("remoteip", remoteIp);

  try {
    const res = await fetch(VERIFY_URL, { method: "POST", body: form });
    if (!res.ok) return { ok: false, errorCodes: [`http-${res.status}`] };
    const data = (await res.json()) as { success: boolean; "error-codes"?: string[] };
    return { ok: data.success, errorCodes: data["error-codes"] };
  } catch {
    // Network / CF outage: fail closed for safety. If this becomes a
    // real availability problem, switch to a counter + circuit breaker.
    return { ok: false, errorCodes: ["network"] };
  }
}
