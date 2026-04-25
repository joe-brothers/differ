# Server tests

## Rate-limit tests

Two flavors. Both target a running server (default `http://localhost:8787`)
and synthesize the `cf-connecting-ip` header to keep buckets isolated across
test runs — so you can re-run them without waiting 60 seconds for the
window to roll.

### Smoke (Node built-in test runner)

Fastest path for local iteration. No extra tooling.

```sh
# terminal 1
pnpm --filter @differ/server dev

# terminal 2
pnpm --filter @differ/server test:rl:smoke
# or against staging:
BASE_URL=https://api.example.com pnpm --filter @differ/server test:rl:smoke
```

### k6 load test

Use this for the authoritative pre-deploy check or when you want to look at
load metrics. Install k6 once (`brew install k6` on macOS) and run:

```sh
# terminal 1
pnpm --filter @differ/server dev

# terminal 2
pnpm --filter @differ/server test:rl:k6
# or:
k6 run packages/server/tests/k6/rate-limit.js
```

The script asserts each scenario via k6 `check()` + `fail()`; a non-zero
exit code means at least one scenario didn't behave as configured in
`wrangler.toml`.

### What is verified

| Endpoint      | Key         | Configured | Test asserts                                                  |
| ------------- | ----------- | ---------: | ------------------------------------------------------------- |
| `/auth/guest` | IP          |   5 / 60 s | 6th request returns 429 + Retry-After                         |
| `/auth/login` | IP+username |   5 / 60 s | 6th attempt at same combo → 429                               |
| `/auth/login` | IP+username |   5 / 60 s | Different username from same IP stays unaffected              |
| `POST /rooms` | userId      |   5 / 60 s | 6th create from same user → 429 (k6 only — needs cookie auth) |

### Why not Vitest?

There's no test runner installed in this repo today, so we opted for Node's
built-in `node:test`: zero dependencies, runs `.ts` directly via
`--experimental-strip-types`. If we add Vitest later for unit tests, these
can migrate trivially.
