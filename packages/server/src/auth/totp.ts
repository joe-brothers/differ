import * as OTPAuth from "otpauth";

// Thin wrapper around `otpauth` so the rest of the codebase doesn't have to
// know the library's option shape. Defaults match the de-facto authenticator
// behaviour (Google Authenticator, 1Password, Authy): SHA-1, 6 digits, 30s
// step. ±1 step skew tolerance for clock drift.
const STEP_SECONDS = 30;
const DIGITS = 6;
const VALIDATE_WINDOW = 1; // ±1 step
const ALGORITHM = "SHA1";
const SECRET_BYTES = 20; // 160-bit per RFC 4226 §4

export function generateSecret(): string {
  return new OTPAuth.Secret({ size: SECRET_BYTES }).base32;
}

export async function verifyTotpCode(secretBase32: string, code: string): Promise<boolean> {
  const cleaned = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;
  let secret: OTPAuth.Secret;
  try {
    secret = OTPAuth.Secret.fromBase32(secretBase32);
  } catch {
    return false;
  }
  const totp = new OTPAuth.TOTP({
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: STEP_SECONDS,
    secret,
  });
  // `validate` returns the delta (0 = current step) on hit, null on miss.
  return totp.validate({ token: cleaned, window: VALIDATE_WINDOW }) !== null;
}

export function buildOtpAuthUrl(params: {
  secret: string;
  account: string;
  issuer: string;
}): string {
  const totp = new OTPAuth.TOTP({
    issuer: params.issuer,
    label: params.account,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: STEP_SECONDS,
    secret: OTPAuth.Secret.fromBase32(params.secret),
  });
  return totp.toString();
}
