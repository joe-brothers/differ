// Password hashing. Argon2id is the current scheme; PBKDF2-SHA256 is kept
// for verifying legacy hashes so existing users can sign in and get rehashed
// transparently on next login (see needsRehash).
//
// Argon2id stored format: PHC standard, e.g.
//   `$argon2id$v=19$m=19456,t=2,p=1$<saltB64>$<hashB64>`
// Legacy PBKDF2 stored format: `pbkdf2$<iterations>$<saltB64>$<hashB64>`.
//
// Implementation note: hash-wasm and other WASM libs can't be used here —
// Cloudflare Workers blocks runtime `WebAssembly.compile()` of arbitrary
// buffers. @noble/hashes is pure JS so it works on the Workers runtime.

import { argon2idAsync } from "@noble/hashes/argon2.js";

// OWASP 2024 minimum profile for argon2id.
const ARGON2_MEMORY_KIB = 19_456;
const ARGON2_ITERATIONS = 2;
const ARGON2_PARALLELISM = 1;
const ARGON2_HASH_LEN = 32;
const ARGON2_SALT_LEN = 16;
const ARGON2_VERSION = 0x13;

const PBKDF2_KEY_LEN_BITS = 256;

function b64encNoPad(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/=+$/, "");
}

function b64dec(s: string): Uint8Array {
  const padLen = (4 - (s.length % 4)) % 4;
  const padded = s + "=".repeat(padLen);
  const bin = atob(padded);
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
  const hash = await argon2idAsync(password, salt, {
    t: ARGON2_ITERATIONS,
    m: ARGON2_MEMORY_KIB,
    p: ARGON2_PARALLELISM,
    dkLen: ARGON2_HASH_LEN,
    version: ARGON2_VERSION,
  });
  const params = `m=${ARGON2_MEMORY_KIB},t=${ARGON2_ITERATIONS},p=${ARGON2_PARALLELISM}`;
  return `$argon2id$v=${ARGON2_VERSION}$${params}$${b64encNoPad(salt)}$${b64encNoPad(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (stored.startsWith("$argon2id$")) return verifyArgon2id(password, stored);
  if (stored.startsWith("pbkdf2$")) return verifyPbkdf2(password, stored);
  return false;
}

// PHC: `$argon2id$v=<ver>$m=<m>,t=<t>,p=<p>$<saltB64>$<hashB64>`
async function verifyArgon2id(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  // ['', 'argon2id', 'v=19', 'm=...,t=...,p=...', saltB64, hashB64]
  if (parts.length !== 6) return false;
  const ver = Number(parts[2]!.slice(2));
  const paramMap = new Map<string, number>();
  for (const kv of parts[3]!.split(",")) {
    const [k, v] = kv.split("=");
    if (!k || !v) return false;
    paramMap.set(k, Number(v));
  }
  const m = paramMap.get("m");
  const t = paramMap.get("t");
  const p = paramMap.get("p");
  if (!Number.isFinite(ver) || !Number.isFinite(m) || !Number.isFinite(t) || !Number.isFinite(p)) {
    return false;
  }
  const salt = b64dec(parts[4]!);
  const expected = b64dec(parts[5]!);
  let actual: Uint8Array;
  try {
    actual = await argon2idAsync(password, salt, {
      t: t!,
      m: m!,
      p: p!,
      dkLen: expected.length,
      version: ver,
    });
  } catch {
    return false;
  }
  return constantTimeEq(actual, expected);
}

async function verifyPbkdf2(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iter = Number(parts[1]);
  if (!Number.isFinite(iter) || iter <= 0) return false;
  const salt = b64dec(parts[2]!);
  const expected = b64dec(parts[3]!);
  const actual = await pbkdf2(password, salt, iter);
  return constantTimeEq(actual, expected);
}

// timingSafeEqual throws on length mismatch — guard first.
function constantTimeEq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  return crypto.subtle.timingSafeEqual(a, b);
}

// True if the stored hash uses an older scheme and should be re-hashed
// after a successful verify.
export function needsRehash(stored: string): boolean {
  return !stored.startsWith("$argon2id$");
}

// Lazy so the cold-start Argon2 cost is only paid once an unknown-user login
// actually arrives. Cached for the isolate's lifetime.
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) dummyHashPromise = hashPassword("differ-timing-dummy");
  return dummyHashPromise;
}

// Called on the "no such user" branch of /login so its latency matches a real
// password verify. Result is discarded.
export async function dummyVerifyForTiming(password: string): Promise<void> {
  try {
    await verifyPassword(password, await getDummyHash());
  } catch {
    /* intentional */
  }
}
