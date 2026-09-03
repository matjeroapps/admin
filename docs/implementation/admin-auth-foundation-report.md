# P4.8 Stage C0 — Admin Browser Authentication Foundation Report

## Metadata
- **Branch**: `feature/admin-auth-foundation`
- **Base SHA**: `c42c79bcf5698235784070ceb38e078caf38c982`
- **Head SHA**: `c6b497f4d9554c1389ecb6923ccc6528b75ce3cb`
- **PR URL**: https://github.com/matjeroapps/admin/pull/3
- **PR Title**: `feat: add admin browser authentication`

## OIDC & Security Architecture
- **OIDC Library**: `oidc-client-ts` (^3.5.0)
- **Flow**: OAuth 2.0 Authorization Code with PKCE. No browser client secret.
- **Token Storage**: State stored in `WebStorageStateStore` backed by `window.sessionStorage`. Tokens are never written to `localStorage` or logged.
- **Single-Flight Token Renewal Design**:
  - `createOidcAuthClient` maintains a single in-flight `renewalPromise: Promise<string | null> | null`.
  - When multiple concurrent API requests trigger token renewal (or `getAccessToken()` detects an expired token), all callers await the exact same promise.
  - Exactly ONE `userManager.signinSilent()` operation is performed.
  - The shared promise is cleared (`renewalPromise = null`) in a `finally` block upon completion (success, failure, or null result) to guarantee stale/rejected promises are never cached.
  - Verified by deterministic unit tests asserting `signinSilent` is called exactly ONCE for 10 concurrent renewal callers, and that subsequent calls initiate a new fresh renewal.
- **Callback Routing & Hardening**:
  - Path-based callback at `/auth/callback` (never fragment-based `/#/auth/callback`).
  - Callback handler is explicitly invoked as `authClient.handleCallback(window.location.href)`.
  - On both successful and failed callback handling, OAuth parameters (`code`, `state`, `error`, `error_description`) are scrubbed from browser history via `window.history.replaceState`.
  - `sanitizeReturnPath` ensures return destinations are same-origin internal routes (e.g. `/dashboard`), preventing open redirects.

## Authentication Behavior & Error Policy
- **Expected Session Termination vs. Auth Errors**:
  - `clearSession()` defaults to normal session clearance (`error: null`), clearing user state to `unauthenticated` (`isAuthenticated = false`, `user = null`, `error = null`).
  - Normal logout, session expiration, and repeated 401s transition cleanly to the `unauthenticated` screen displaying the "Sign in" action (NOT an error banner).
  - `Authentication Error` state is reserved for actual failures (initialization failure, malformed callback).
  - 403 Forbidden retains the valid session and renders the Access Denied screen (`RolePlatformAdmin` required) without triggering renewal or login loops.
  - Fetch requests do NOT auto-redirect to login; user initiates login explicitly.
- **Fail-Closed Policy**: If production environment is missing `VITE_ZITADEL_ISSUER` or `VITE_ZITADEL_CLIENT_ID`, application enters an explicit `Authentication Configuration Error` state. No fake user, token, or dev-access-token is generated, and no business APIs (`/v1/admin/*`) are invoked.
- **Dev-Auth Negative Matrix**:
  - Helper `checkDevAuthEnabled(isDev, devAuthEnvVal)` enforces strict dev-auth policy.
  - Negative matrix verified by unit tests:
    1. `DEV=false`, `VITE_ADMIN_DEV_AUTH=true` -> `false`
    2. `DEV=true`, `VITE_ADMIN_DEV_AUTH` missing -> `false`
    3. `DEV=true`, `VITE_ADMIN_DEV_AUTH=false` -> `false`
    4. Positive: `DEV=true` AND `VITE_ADMIN_DEV_AUTH=true` -> `true`
  - Dev tokens are completely unreachable in production builds.
- **Backend Authorization Authority**: Backend `admin-api` enforces `RequireAuth: true` and `AllowedRoles: [RolePlatformAdmin]`. Browser UI role check is non-authoritative.

## ZITADEL SPA Deployment Configuration
To support background session renewal via `signinSilent`, the ZITADEL instance must be configured with:
1. **Application Type**: **SPA** (Single Page Application, Public Client, PKCE enabled, no secret).
2. **Redirect URIs**: `https://<admin-domain>/auth/callback`
3. **Post Logout Redirect URIs**: `https://<admin-domain>`
4. **Scopes**: `openid profile email offline_access`
5. **Refresh Token Grant**: Refresh token / offline_access renewal must be enabled for the SPA application.

## Production Static Runtime
- **Static Server**: Standalone zero-dependency Node.js server (`web/admin/server.js`) serving `web/admin/dist`.
- **Dockerfile**: `docker/web-app.Dockerfile` includes production stage `FROM node:24-alpine AS admin` running unprivileged as `USER node` on port 5173.
- **Routing**:
  - `GET /` -> `index.html`
  - `GET /auth/callback?code=...` -> `index.html` (SPA fallback)
  - `GET /assets/*` -> real built assets
  - `GET /v1/*` / `GET /api/*` -> returns `404 JSON` (not index.html)

## Test Suite & Verification Results
- **Frontend Test Infrastructure**: Vitest + Testing Library + jsdom (26 tests across 4 files) passed cleanly.
- **Static Routing Smoke**:
  ```text
  ADMIN CALLBACK STATIC ROUTING SMOKE: PASS
  ```
- **Fresh Clone**: Verified outside workspace in `/tmp/fresh-admin-check-final`. All build, lint, typecheck, and test commands passed.
- **Docker Build**: Verified image build using `docker/web-app.Dockerfile`.
- **Go Backend & OpenAPI**: All Go unit tests, `go vet`, and OpenAPI spec generation passed with zero drift.

## Zitadel Real Smoke Status
```text
REAL ZITADEL SMOKE NOT EXECUTED
```
