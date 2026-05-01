# differ

[![CI](https://github.com/joe-brothers/differ/actions/workflows/ci.yml/badge.svg)](https://github.com/joe-brothers/differ/actions/workflows/ci.yml)

Spot-the-Difference multiplayer game.

## Packages

| Package                | What                                          | Runtime                       |
| ---------------------- | --------------------------------------------- | ----------------------------- |
| `packages/shared`      | Zod schemas shared between server and client. | —                             |
| `packages/server`      | API + game rooms + matchmaking (Hono).        | Cloudflare Workers, D1, DO    |
| `packages/client`      | PixiJS web client.                            | Cloudflare Pages (Vite build) |
| `packages/tail-worker` | Forwards production errors to Discord.        | Cloudflare Tail Worker        |

See [CONTRIBUTING.md](./CONTRIBUTING.md) for full dev workflow, deployment, and conventions.
[SECURITY.md](./SECURITY.md) covers reporting vulnerabilities.
