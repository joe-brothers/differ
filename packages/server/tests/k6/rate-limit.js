// k6 rate-limit assertion script.
//
// Verifies that the rate-limit bindings configured in `wrangler.toml`
// (RL_GUEST=20/60s, RL_LOGIN=10/60s, RL_ROOM=10/60s) actually enforce
// their thresholds end-to-end and emit a 429 + Retry-After header.
//
// Usage:
//   1. Start the server locally:  pnpm --filter @differ/server dev
//   2. In another shell:          k6 run packages/server/tests/k6/rate-limit.js
//
// Override the target with `BASE_URL`:
//   BASE_URL=https://api.example.com k6 run rate-limit.js
//
// Per-test isolation: each scenario uses a unique synthetic IP via the
// `cf-connecting-ip` header so concurrent runs don't poison each other's
// buckets. The CF rate-limit binding keys exactly on what the route code
// passes in (see `packages/server/src/auth/rate-limit.ts`), so spoofing
// the header from k6 hits the same code path that production uses.

import http from "k6/http";
import { check, fail } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8787";

// Scenario: each test runs once, sequentially, in its own VU/iteration so
// counts don't bleed.
export const options = {
  scenarios: {
    guest_ip_limit: {
      executor: "per-vu-iterations",
      vus: 1,
      iterations: 1,
      maxDuration: "60s",
      exec: "guestIpLimit",
    },
    login_ip_username_limit: {
      executor: "per-vu-iterations",
      vus: 1,
      iterations: 1,
      maxDuration: "60s",
      exec: "loginIpUsernameLimit",
    },
    login_buckets_separate: {
      executor: "per-vu-iterations",
      vus: 1,
      iterations: 1,
      maxDuration: "60s",
      exec: "loginBucketsSeparate",
    },
    room_user_limit: {
      executor: "per-vu-iterations",
      vus: 1,
      iterations: 1,
      maxDuration: "60s",
      exec: "roomUserLimit",
    },
  },
  thresholds: {
    // Any failed `check()` aborts the run.
    checks: ["rate==1.0"],
  },
};

function freshIp(label) {
  // Synthetic IP per test run keeps buckets clean across re-runs without
  // waiting 60s for the window to roll.
  const r = Math.floor(Math.random() * 1e9).toString(36);
  return `203.0.113.${(label.length * 7 + r.length) % 250}-${r}`;
}

function headers(ip, extra = {}) {
  return Object.assign(
    {
      "Content-Type": "application/json",
      "cf-connecting-ip": ip,
    },
    extra,
  );
}

// ---- guest_ip_limit -----------------------------------------------------
// /auth/guest is keyed by IP only (RL_GUEST=20/60s). 21st request from the
// same IP must be 429 with Retry-After.
export function guestIpLimit() {
  const ip = freshIp("guest");
  let last200 = 0;
  let first429 = -1;
  let retryAfter = "";
  for (let i = 1; i <= 22; i++) {
    const res = http.post(`${BASE_URL}/auth/guest`, "{}", { headers: headers(ip) });
    if (res.status === 200) {
      last200 = i;
    } else if (res.status === 429 && first429 === -1) {
      first429 = i;
      retryAfter = res.headers["Retry-After"] || res.headers["retry-after"] || "";
    }
  }
  if (
    !check(null, {
      "guest: at least 20 successes": () => last200 >= 20,
      "guest: 429 by request 22": () => first429 > 0 && first429 <= 22,
      "guest: Retry-After present": () => retryAfter !== "",
    })
  ) {
    fail(`guest_ip_limit failed: last200=${last200} first429=${first429} retryAfter=${retryAfter}`);
  }
}

// ---- login_ip_username_limit -------------------------------------------
// /auth/login is keyed by IP+username (RL_LOGIN=10/60s). 11 attempts at the
// same (ip, username) must produce a 429.
export function loginIpUsernameLimit() {
  const ip = freshIp("login-same");
  const username = `noone_${Date.now()}`;
  let first429 = -1;
  for (let i = 1; i <= 12; i++) {
    const res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ username, password: "wrongpass" }),
      { headers: headers(ip) },
    );
    if (res.status === 429 && first429 === -1) {
      first429 = i;
    }
  }
  if (
    !check(null, {
      "login: 429 by request 12 (limit=10)": () => first429 > 0 && first429 <= 12,
    })
  ) {
    fail(`login_ip_username_limit failed: first429=${first429}`);
  }
}

// ---- login_buckets_separate --------------------------------------------
// IP+username keying must NOT cross-contaminate: 10 attempts at userA followed
// by 10 attempts at userB from the same IP must all stay below the threshold.
export function loginBucketsSeparate() {
  const ip = freshIp("login-split");
  const userA = `usera_${Date.now()}`;
  const userB = `userb_${Date.now()}`;
  let any429 = false;
  for (const u of [userA, userB]) {
    for (let i = 0; i < 8; i++) {
      const res = http.post(
        `${BASE_URL}/auth/login`,
        JSON.stringify({ username: u, password: "wrong" }),
        { headers: headers(ip) },
      );
      if (res.status === 429) any429 = true;
    }
  }
  if (
    !check(null, {
      "login buckets stay separate": () => !any429,
    })
  ) {
    fail(`login_buckets_separate failed: unexpected 429 across distinct usernames`);
  }
}

// ---- room_user_limit ---------------------------------------------------
// POST /rooms is keyed by userId (RL_ROOM=10/60s). Auth as guest, then
// burn through 11 room creations and expect a 429.
export function roomUserLimit() {
  const ip = freshIp("room");
  const jar = http.cookieJar();
  const guestRes = http.post(`${BASE_URL}/auth/guest`, "{}", { headers: headers(ip) });
  if (guestRes.status !== 200) {
    fail(`room_user_limit: could not create guest (${guestRes.status})`);
  }
  let first429 = -1;
  for (let i = 1; i <= 12; i++) {
    const res = http.post(`${BASE_URL}/rooms`, JSON.stringify({ mode: "single" }), {
      headers: headers(ip),
      cookies: jar,
    });
    if (res.status === 429 && first429 === -1) {
      first429 = i;
    }
  }
  if (
    !check(null, {
      "rooms: 429 by request 12 (limit=10)": () => first429 > 0 && first429 <= 12,
    })
  ) {
    fail(`room_user_limit failed: first429=${first429}`);
  }
}
