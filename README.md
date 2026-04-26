# differ

[![CI](https://github.com/joe-brothers/differ/actions/workflows/ci.yml/badge.svg)](https://github.com/joe-brothers/differ/actions/workflows/ci.yml)

Spot-the-Difference multiplayer game.

- `packages/shared` — Zod schemas shared between server and client.
- `packages/server` — Cloudflare Workers + Durable Objects (Hono, D1).
- `packages/client` — PixiJS web client (Vite).

## Setup (first clone)

Requires [mise](https://mise.jdx.dev). It installs node, hk, and pkl pinned in `mise.toml`.

```bash
mise install       # node, hk, pkl
pnpm install       # workspace deps (oxlint, oxfmt, ...)
hk install         # git pre-commit / pre-push hooks
```

## Dev

```bash
# 1. local D1 setup (first time only)
cd packages/server
pnpm exec wrangler d1 migrations apply differ --local
node --experimental-strip-types scripts/import-puzzles.ts
pnpm exec wrangler d1 execute differ --local --file scripts/seed/puzzles.sql
echo 'JWT_SECRET=dev-secret-change-me' > .dev.vars

# 2. run (two terminals)
pnpm dev:server    # wrangler dev @ http://localhost:8787
pnpm dev:client    # vite @ http://localhost:8080
```

`git commit` auto-runs `oxlint --fix` + `oxfmt --write` on staged files via hk. Manual commands:

```bash
pnpm lint            # oxlint
pnpm format          # oxfmt --write
hk run check --all   # lint + format check across the repo (CI)
```

Images are served from R2 at `https://differ-assets.joe-brothers.com`.

## Deploy

```bash
cd packages/server
wrangler d1 create differ                 # copy the printed database_id into wrangler.toml
wrangler d1 migrations apply differ --remote
wrangler d1 execute differ --remote --file scripts/seed/puzzles.sql
wrangler secret put JWT_SECRET            # paste a strong random value
wrangler deploy
```
