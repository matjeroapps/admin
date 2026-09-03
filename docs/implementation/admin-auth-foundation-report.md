# P4.8 Stage C0 — Admin Browser Authentication Foundation Report

## Metadata
- **Branch**: `feature/admin-auth-foundation`
- **Base SHA**: `c42c79bcf5698235784070ceb38e078caf38c982`
- **Head SHA**: `a3224c75112edd4c6acb5d74d5a63b577e4e769a`
- **PR Title**: `feat: add admin browser authentication`

## OIDC & Security Architecture
- **OIDC Library**: `oidc-client-ts` (^3.5.0)
- **Flow**: OAuth 2.0 Authorization Code with PKCE. No browser client secret.
- **Token Storage**: State stored in `WebStorageStateStore` backed by `window.sessionStorage`. Tokens are never written to `localStorage` or logged.
- **Renewal Strategy**: On 401 response, API client performs at most 1 token renewal (`renewToken()`) and retries original request ONCE.
- **Callback Routing**: Path-based callback at `/auth/callback` (never fragment-based `/#/auth/callback`).
- **Return-Path Sanitization**: `sanitizeReturnPath` ensures return destinations are same-origin internal routes (e.g. `/`), preventing open redirects.

## Authentication Behavior & Error Policy
- **401 / 403 Policy**:
  - Repeated 401: Clears session and transitions UI to unauthenticated state.
  - 403 Access Denied: Retains valid session, invokes `onForbidden`, and renders access-denied state (`RolePlatformAdmin` required). Prevents redirect loops.
  - No auto-redirect on fetch: Network requests update state; user initiates login via UI.
- **Fail-Closed Policy**: If production environment is missing `VITE_ZITADEL_ISSUER` or `VITE_ZITADEL_CLIENT_ID`, application enters `Authentication Configuration Error` state. No fake user, fake token, or dev-access-token is generated, and no business APIs (`/v1/admin/*`) are invoked.
- **Dev Auth Policy**: Development bypass operates ONLY when `import.meta.env.DEV` is true AND `VITE_ADMIN_DEV_AUTH === "true"`. Production builds ignore dev auth settings.
- **Backend Authorization Authority**: Backend `admin-api` enforces `RequireAuth: true` and `AllowedRoles: [RolePlatformAdmin]`. Browser UI role check is non-authoritative.

## Production Static Runtime
- **Static Server**: Standalone zero-dependency Node.js server (`web/admin/server.js`) serving `web/admin/dist`.
- **Dockerfile**: `docker/web-app.Dockerfile` includes production stage `FROM node:24-alpine AS admin` running unprivileged as `USER node` on port 5173.
- **Routing**:
  - `GET /` -> `index.html`
  - `GET /auth/callback?code=...` -> `index.html` (SPA fallback)
  - `GET /assets/*` -> real built assets
  - `GET /v1/*` / `GET /api/*` -> returns `404 JSON` (not index.html)

## Test Suite & Verification Results
- **Frontend Test Infrastructure**: Vitest + Testing Library + jsdom integrated into `npm run test`.
- **Static Routing Smoke**:
  ```text
  ADMIN CALLBACK STATIC ROUTING SMOKE: PASS
  ```
- **Fresh Clone**: Verified outside workspace in `/tmp/fresh-admin-check`. All build, lint, typecheck, and test commands passed cleanly.
- **Docker Build**: Verified image build using `docker/web-app.Dockerfile`.
- **Go Backend & OpenAPI**: All Go unit tests, `go vet`, and OpenAPI spec generation passed with zero drift.

## Zitadel Real Smoke Status
```text
REAL ZITADEL SMOKE NOT EXECUTED
```
