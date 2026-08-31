# Matjero Admin

Admin Platform for Matjero: the `admin-api` Go service and the `admin-web` React
frontend.

This repository depends on [`matjeroapps/core`](https://github.com/matjeroapps/core)
for shared domain logic (commerce, markets, themes persistence), platform packages
(auth, config, database, httpx, i18n, money, observability, outbox/inbox), the actor
router, and the shared OpenAPI primitives. It owns no database migrations — those
stay centralized in `matjeroapps/core` `migrations/`.

## Layout

| Path | Purpose |
| --- | --- |
| `apps/admin-api` | Admin HTTP service entrypoint |
| `internal/adminapi` | Admin route registration and admin-only DTOs |
| `internal/openapi` | Admin OpenAPI document (code-first) |
| `cmd/openapi-gen` | Regenerates `docs/api/admin/openapi.json` |
| `web/admin` | Admin frontend (`@commerce/admin-web`) |
| `docs/api/admin` | Generated OpenAPI artifact, committed for drift detection |

## Local Development

```sh
cp .env.example .env
go build ./...
go test ./...
go run ./cmd/openapi-gen && git diff --exit-code -- docs/api
npm install
npm run lint
npm run typecheck
npm run test
```

Infrastructure (PostgreSQL, Redis, RabbitMQ, ZITADEL) is provided by the
`docker-compose.yml` in `matjeroapps/core`.

## Cross-repository dependency

`go.mod` requires `github.com/matjeroapps/core` at a published version. Never
commit a `replace` directive pointing at a local path.

For side-by-side development, use a Go workspace file kept **outside** both
repositories (for example in their shared parent directory):

```sh
go work init ./core ./admin
```

`go.work` and `go.work.sum` are git-ignored so they can never be committed.

