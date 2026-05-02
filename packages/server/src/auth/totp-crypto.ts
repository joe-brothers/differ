// Envelope encryption for TOTP shared secrets at rest.
//
// The KEK (Key Encryption Key) lives in Workers Secrets (`TOTP_KEK`), not in
// D1 — so a database dump alone yields ciphertext only. The KEK is a 32-byte
// AES-256 key, base64-encoded in the secret value. Generate with:
//   openssl rand -base64 32
//
// Stored format: `v1:<iv_b64>:<ct_b64>` where `ct` includes the GCM auth tag
// (WebCrypto appends it). The `v1:` prefix is a version marker so a future
// algorithm/key rotation can ship as `v2:` without ambiguity.

const FORMAT_VERSION = "v1";
const IV_BYTES = 12; // 96-bit IV is the AES-GCM standard
const KEK_BYTES = 32; // AES-256

function b64enc(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function b64dec(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importKek(kekB64: string): Promise<CryptoKey> {
  const raw = b64dec(kekB64);
  if (raw.length !== KEK_BYTES) {
    throw new Error(`TOTP_KEK must decode to ${KEK_BYTES} bytes, got ${raw.length}`);
  }
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptTotpSecret(plain: string, kekB64: string): Promise<string> {
  const key = await importKek(kekB64);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plain),
  );
  return `${FORMAT_VERSION}:${b64enc(iv)}:${b64enc(new Uint8Array(ct))}`;
}

export async function decryptTotpSecret(stored: string, kekB64: string): Promise<string> {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== FORMAT_VERSION) {
    throw new Error("totp secret: unrecognized format");
  }
  const iv = b64dec(parts[1]!);
  const ct = b64dec(parts[2]!);
  const key = await importKek(kekB64);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(plain);
}
