// Password hashing. Argon2id is the current scheme; PBKDF2-SHA256 is kept
// for verifying legacy hashes so existing users can sign in and get rehashed
// transparently on next login (see needsRehash).
//
// Argon2id stored format: PHC standard, e.g.
//   `$argon2id$v=19$m=19456,t=2,p=1$<saltB64>$<hashB64>`
// Legacy PBKDF2 stored format: `pbkdf2$<iterations>$<saltB64>$<hashB64>`.

import { argon2id, argon2Verify } from "hash-wasm";

// OWASP 2024 minimum for argon2id: m=19 MiB, t=2, p=1.
const ARGON2_MEMORY_KIB = 19_456;
const ARGON2_ITERATIONS = 2;
const ARGON2_PARALLELISM = 1;
const ARGON2_HASH_LEN = 32;
const ARGON2_SALT_LEN = 16;

const PBKDF2_KEY_LEN_BITS = 256;

function b64dec(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    PBKDF2_KEY_LEN_BITS,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(ARGON2_SALT_LEN));
  return argon2id({
    password,
    salt,
    parallelism: ARGON2_PARALLELISM,
    iterations: ARGON2_ITERATIONS,
    memorySize: ARGON2_MEMORY_KIB,
    hashLength: ARGON2_HASH_LEN,
    outputType: "encoded",
  });
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (
    stored.startsWith("$argon2id$") ||
    stored.startsWith("$argon2i$") ||
    stored.startsWith("$argon2d$")
  ) {
    try {
      return await argon2Verify({ password, hash: stored });
    } catch {
      return false;
    }
  }
  if (stored.startsWith("pbkdf2$")) {
    return verifyPbkdf2(password, stored);
  }
  return false;
}

async function verifyPbkdf2(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iter = Number(parts[1]);
  if (!Number.isFinite(iter) || iter <= 0) return false;
  const salt = b64dec(parts[2]!);
  const expected = b64dec(parts[3]!);
  const actual = await pbkdf2(password, salt, iter);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ expected[i]!;
  return diff === 0;
}

// True if the stored hash uses an older scheme and should be re-hashed
// after a successful verify.
export function needsRehash(stored: string): boolean {
  return !stored.startsWith("$argon2id$");
}
