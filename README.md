# Matjero Admin

Admin Platform for Matjero: the `admin-api` Go service and the `admin-web` React
frontend.

## Repository Independence Rule

This repository imports **no** Matjero Go module. It is independently cloneable,
buildable, testable, lintable, Docker-buildable, CI-runnable and deployable.

Every Core-owned business capability — commerce, markets, catalog, listings,
inventory and platform moderation — is reached at runtime through the Core
internal HTTP API (`core-api`, `/internal/v1`) via this repository's own client
in `internal/coreclient`. See
[ADR-017](https://github.com/matjeroapps/core/blob/main/docs/plans/adr/ADR-017-repository-independence-and-runtime-service-boundaries.md).

Small generic technical helpers (config, httpx, i18n, money, auth, logging,
observability, actor router, OpenAPI primitives) are localized under `internal/`
rather than shared. Cross-repository DRY is deliberately sacrificed for
independence; business logic is never duplicated, only called.

This repository owns no database and no migrations. Migrations stay centralized
in `matjeroapps/core` `migrations/`.

## Layout

| Path | Purpose |
| --- | --- |
| `apps/admin-api` | Admin HTTP service entrypoint |
| `internal/adminapi` | Admin route registration and admin-only DTOs |
| `internal/coreclient` | This repository's HTTP client for the Core internal API |
| `internal/openapi` | Admin OpenAPI document (code-first) |
| `cmd/openapi-gen` | Regenerates `docs/api/admin/openapi.json` |
| `web/admin` | Admin frontend (`@commerce/admin-web`) |
| `docs/api/admin` | Generated OpenAPI artifact, committed for drift detection |

## Local Development

```sh
cp .env.example .env
GOWORK=off go build ./...
GOWORK=off go test ./...
GOWORK=off go run ./cmd/openapi-gen && git diff --exit-code -- docs/api
npm install
npm run lint
npm run typecheck
npm run test
```

All verification uses `GOWORK=off` so the repository behaves identically whether
or not a local Go workspace exists.

`admin-api` requires `CORE_API_BASE_URL` and `CORE_API_TOKEN`; it refuses to
start without them. The token must match `CORE_INTERNAL_ADMIN_TOKEN` on the Core
side.

Infrastructure (PostgreSQL, Redis, RabbitMQ, ZITADEL) is provided by the
`docker-compose.yml` in `matjeroapps/core`. Admin itself connects to none of
them: it has no database.

## Cross-repository dependency

There is none. `go.mod` requires no `github.com/matjeroapps/*` module other than
this repository itself, and no Go file imports another Matjero repository. CI
enforces this on every push.

A Go workspace file may still be used for side-by-side development, kept
**outside** every repository (for example in their shared parent directory):

```sh
go work init ./core ./admin
```

`go.work` and `go.work.sum` are git-ignored so they can never be committed, and
no repository may require one.

