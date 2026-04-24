# differ

Spot-the-Difference multiplayer game.

- `packages/shared` — Zod schemas shared between server and client.
- `packages/server` — Cloudflare Workers + Durable Objects (Hono, D1).
- `packages/client` — PixiJS web client (Vite).

## Dev

```bash
pnpm install

# 1. local D1 setup (first time)
cd packages/server
pnpm exec wrangler d1 migrations apply differ --local
node --experimental-strip-types scripts/import-puzzles.ts
pnpm exec wrangler d1 execute differ --local --file scripts/seed/puzzles.sql
echo 'JWT_SECRET=dev-secret-change-me' > .dev.vars

# 2. run (two terminals)
pnpm dev:server    # wrangler dev @ http://localhost:8787
pnpm dev:client    # vite @ http://localhost:8080
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
