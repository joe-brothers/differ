// Quick smoke test for rate limits using Node's built-in test runner.
// Zero deps — runs with `node --test --experimental-strip-types`.
//
// Use this for fast local iteration; the k6 script under tests/k6/ is the
// authoritative load-style test (per-VU isolation, cookies, thresholds).
//
// Usage:
//   1. pnpm --filter @differ/server dev
//   2. pnpm --filter @differ/server test:rl:smoke
//      (override BASE_URL=http://... to hit a deployed env)

import test from "node:test";
import assert from "node:assert/strict";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8787";

function freshIp(tag: string): string {
  const r = Math.floor(Math.random() * 1e9).toString(36);
  return `198.51.100.${(tag.length * 13) % 250}-${r}`;
}

async function postJson(
  path: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

// Sequential awaits in these loops are intentional: rate-limit windows are
// stateful and the assertion is on the request-ordinal at which a 429 first
// appears. Parallel `Promise.all` would race and break the assertion.
/* eslint-disable no-await-in-loop */

test("guest endpoint enforces per-IP limit (20/60s)", async () => {
  const ip = freshIp("guest");
  const headers = { "cf-connecting-ip": ip };

  let last200 = 0;
  let first429 = -1;
  let retryAfter = "";
  for (let i = 1; i <= 22; i++) {
    const res = await postJson("/auth/guest", {}, headers);
    if (res.status === 200) last200 = i;
    else if (res.status === 429 && first429 === -1) {
      first429 = i;
      retryAfter = res.headers.get("retry-after") ?? "";
    }
    await res.body?.cancel();
  }

  assert.ok(last200 >= 20, `expected ≥20 successes, got ${last200}`);
  assert.ok(first429 > 0 && first429 <= 22, `expected 429 within 22 reqs, got at ${first429}`);
  assert.ok(retryAfter.length > 0, "Retry-After header missing on 429");
});

test("login endpoint keys by IP+username — same combo trips after 10", async () => {
  const ip = freshIp("login-same");
  const username = `nope_${Date.now()}`;
  const headers = { "cf-connecting-ip": ip };

  let first429 = -1;
  for (let i = 1; i <= 12; i++) {
    const res = await postJson("/auth/login", { username, password: "x" }, headers);
    if (res.status === 429 && first429 === -1) first429 = i;
    await res.body?.cancel();
  }

  assert.ok(first429 > 0 && first429 <= 12, `expected 429 by req 12, got at ${first429}`);
});

test("login buckets are independent across usernames from same IP", async () => {
  const ip = freshIp("login-split");
  const userA = `a_${Date.now()}`;
  const userB = `b_${Date.now()}`;
  const headers = { "cf-connecting-ip": ip };

  let any429 = false;
  for (const u of [userA, userB]) {
    for (let i = 0; i < 8; i++) {
      const res = await postJson("/auth/login", { username: u, password: "x" }, headers);
      if (res.status === 429) any429 = true;
      await res.body?.cancel();
    }
  }

  assert.equal(any429, false, "expected no 429s when usernames differ");
});
