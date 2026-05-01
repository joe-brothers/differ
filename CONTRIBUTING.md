# Contributing

## Prerequisites

- [mise](https://mise.jdx.dev) (see `mise.toml`)
- Cloudflare account + `wrangler` login (`pnpm exec wrangler login` from any worker package) for remote D1 / deploy.

```bash
mise install
pnpm install
hk install        # git hooks: oxlint --fix + oxfmt --write on staged files
```

## Repository layout

```
packages/
  shared/        Zod schemas shared between server and client
  server/        Hono on Workers — API, rooms (DO), matchmaking (DO), daily cron
  client/        Vite + React + PixiJS, deployed to Cloudflare Pages
  tail-worker/   Cloudflare Tail Worker — forwards errors to Discord
```

## Naming conventions (Cloudflare resources)

|                    | Local                 | Production      |
| ------------------ | --------------------- | --------------- |
| Server worker name | `differ-server-local` | `differ-server` |
| Tail worker name   | `differ-tail-local`   | `differ-tail`   |
| D1 database name   | `differ-local`        | `differ`        |
| Rate-limit ns ids  | `1xxx`                | `2xxx`          |

The `*-local` suffix is what makes local Cloudflare dev registry discovery
work — the server's `tail_consumers.service` matches the tail worker's local
`name`. Don't deploy the `-local` names to production.

Rate-limit `namespace_id` counters are shared across all deployments using the
same id, so prod and dev are split (`1xxx` vs `2xxx`) to avoid leaking dev
test traffic into the prod rate-limit window.

## Local development

### Run everything

```bash
pnpm dev:workers      # server (primary, :8787) + tail-worker
pnpm dev:client       # vite (:8080), proxies API/WS to :8787
```

### D1 (local sqlite via miniflare)

The local DB is `differ-local` (prod is `differ`). State persists under
`packages/server/.wrangler/state`.

```bash
cd packages/server
pnpm db:migrate:local                     # apply migrations
pnpm db:seed:local                        # regenerates puzzles.sql + loads it
pnpm exec wrangler d1 execute differ-local --local --command "SELECT 1"
```

Reset:

```bash
rm -rf packages/server/.wrangler/state
pnpm db:migrate:local
pnpm db:seed:local
```

## Deployment

### Tail worker

```bash
cd packages/tail-worker
pnpm exec wrangler secret put DISCORD_WEBHOOK_URL --env production
pnpm deploy:prod
```

### Server

First time only — provision D1 and seed:

```bash
cd packages/server
pnpm exec wrangler d1 create differ        # paste the printed id into wrangler.toml's [env.production] block
pnpm db:migrate:prod
pnpm db:seed:prod
pnpm exec wrangler secret put JWT_SECRET --env production
pnpm exec wrangler secret put TURNSTILE_SECRET --env production
```

Each deploy:

```bash
pnpm db:migrate:prod          # if there are new migrations
pnpm deploy:prod
```

The daily-puzzle cron (`5 0 * * *` UTC) is wired in production
`[env.production.triggers]`; lazy-build in `getDailyRound` covers a missed
firing.

### Client (Cloudflare Pages)

Pages auto-builds from the GitHub repo.
