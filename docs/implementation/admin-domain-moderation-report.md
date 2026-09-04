# Technical Implementation Report — Stage C1 Admin Domain Moderation

## 1. Governance & Metadata
- **Branch**: `feature/admin-domain-moderation`
- **Base SHA**: `5b9d16c26a52c4faa0cd7193d975841cb1ecde7f`
- **Head SHA**: `7e303c921ee6ad04b77f30ae25eeefaa317cb25e`
- **Core Dependency SHA**: `96cf98e5a1f1de3f388a86e316b5b59414d49d11`
- **PR Title**: `feat: add admin domain moderation`

## 2. Public API Surface & Core Client Methods
- **Admin Public Endpoints**:
  - `GET /v1/admin/domains`
  - `POST /v1/admin/domains/{domain_id}/disable`
  - `POST /v1/admin/domains/{domain_id}/enable`
- **Core Client Methods**:
  - `ListDomains(ctx context.Context, filter DomainFilter) ([]StoreDomain, error)`
  - `DisableDomain(ctx context.Context, domainID string) (StoreDomain, error)`
  - `EnableDomain(ctx context.Context, domainID string) (StoreDomain, error)`
- **Path Escaping**: `DisableDomain` and `EnableDomain` construct URLs using `url.PathEscape(domainID)` to prevent path injection.

## 3. Filter Contract & Forwarding
- **Supported Query Parameters**:
  - `store_id`
  - `seller_id`
  - `status` (options: `pending`, `verified`, `active`, `failed`, `disabled`)
  - `domain_type` (options: `platform`, `custom`)
  - `search` (hostname search)
  - `limit` & `offset` (bounded pagination)
- **Forwarding Rule**: `ListDomains` forwards non-empty filters to Core `/internal/v1/domains`.

## 4. Privacy & Security Safeguards
- `verification_token`, `record_value`, and TXT ownership challenge secrets are omitted from `StoreDomain` DTOs and public Admin responses.
- Backend authorization strictly requires `RequireAuth: true` and `AllowedRoles: [RolePlatformAdmin]`.
  - Unauthenticated requests -> `401 Unauthorized`
  - Non-platform-admin requests -> `403 Forbidden`

## 5. Lifecycle Moderation Semantics & Primary Fallback
- **Disable Action**:
  - Disabling target clears `is_primary`. If target was primary, Core promotes an eligible active platform domain for the Store.
- **Enable Action**:
  - Only valid when current `status == disabled`.
  - Calling enable on `active`, `verified`, `pending`, `failed` returns `409 Conflict` from Core.
  - Re-enabling a custom domain with `verified_at != null` returns it to `verified` status (not directly `active`). Seller activation is required.
  - Re-enabling a custom domain with `verified_at == null` returns it to `pending` status.
  - Re-enabling a platform domain returns it to `active`.
  - UI reloads authoritative state post-action and does not guess fallback results locally.

## 6. Concurrent Moderation & 409 Conflict Handling
- If domain state changes concurrently, Core returns `409 Conflict`.
- Admin UI catches `409`, displays safe notice `"Domain state changed. Refresh and try again."`, and reloads authoritative state automatically.
- Per-domain action state (`actionInFlightDomainId`) prevents duplicate button clicks while actions are in flight.

## 7. Async Stale-Request Isolation
- Request generation counter (`requestGenRef`) guards search, filter, and pagination changes.
- Out-of-order responses from earlier filter/search queries are deterministically discarded so they never overwrite newer filter state.

## 8. Frontend UI & Accessibility
- **Component**: `web/admin/src/components/DomainModerationPanel.tsx`
- Renders domain hostname in LTR (`dir="ltr"`), status badges, domain type, primary/secondary pills, store/seller lookup context.
- Modal confirmation dialogs for Disable and Enable actions.
- Bounded pagination with Previous / Next buttons.
- Fully localized in English (`en`) and Arabic (`ar`) with RTL layout support.
- Accessibility baseline: keyboard navigation, ARIA roles, `aria-live` for status/error updates.

## 9. Supplier-as-Seller Compatibility Invariant
- Stores are strictly owned via `seller_id` (`Store -> seller_id`).
- Domain moderation remains Store and domain-scoped, maintaining compatibility with future explicit Supplier-Seller affiliations without introducing premature cross-principal shortcuts.

## 10. Known Limitation
- Core Admin Domain DTO contains `store_id` but not embedded Seller/Store display objects. The Admin UI hydrates Store and Seller display metadata (`name`, `code`) using existing loaded Admin Store and Seller list data, displaying safe shortened Store IDs (`store_id.slice(0,8)`) when context is outside the currently loaded page.

## 11. OpenAPI & Validation
- Admin OpenAPI specification in `internal/openapi/specs.go` updated and regenerated at `docs/api/admin/openapi.json`.
- All backend Go tests (`go test -count=1 ./...`), `go vet`, `gofmt`, `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`, and `gitleaks` pass with zero failures.

## 12. Post-Merge Corrective Hardening

### Overview
- **Merged PR**: #4 (commit `6d22220c5a75610051855832c6b1f2308d334397`)
- **Merge Base SHA**: `c611db032a35096663e0013f5211b943d582428a`
- **Core Dependency SHA**: `96cf98e5a1f1de3f388a86e316b5b59414d49d11`
- **Hardening Branch**: `fix/admin-domain-moderation-hardening`

### Technical Improvements & Fixes
1. **View Generation vs Request Generation Isolation**:
   - Introduced `viewGenRef` separate from `requestGenRef`.
   - `viewGenRef` increments whenever user changes the moderation view parameters (search, status filter, domain type filter, seller filter, store filter, pagination offset, or clear filters).
   - In-flight actions capture `actionViewGen = viewGenRef.current` and verify `actionViewGen === viewGenRef.current` before performing any UI state updates, reloads, or error notices.
   - Added deterministic regression tests verifying that stale actions do not reload previous views or display stale 409 notices when view navigation occurs while POST is pending.

2. **Platform-Wide Seller & Store Filters**:
   - Replaced restrictive `<select>` dropdowns with `<input list="...">` and `<datalist>` suggestion controls.
   - Any arbitrary Seller ID or Store ID accepted by Core can be directly entered, enabling platform-wide moderation beyond loaded context pages.
   - Loaded context arrays are strictly presentation suggestions.
   - Added regression tests verifying arbitrary ID forwarding (`seller-999`, `store-999`) and pagination offset resets on filter changes.

3. **Deterministic Stale-Search Regression Test**:
   - Rewrote stale-search test using Vitest fake timers (`vi.useFakeTimers()`) to deterministically advance debounce timers by 300ms, proving that Search A and Search B both start and remain pending before resolving in reverse order.

4. **Raw-Response Privacy Assertion**:
   - Fixed backend privacy test in `internal/adminapi/domains_test.go` to capture raw body bytes (`rec.Body.Bytes()`) prior to JSON decoding, eliminating the consumed body check flaw.

5. **Bounded Response Coverage**:
   - Added `t.Run("oversized response")` in `internal/coreclient/domains_test.go` verifying that responses exceeding `maxResponseBytes` (8 MiB) fail safely without unbounded memory reads.

### Validation Results
- **Go Tests**: `GOWORK=off go test -count=1 ./...` passed (100% pass rate across packages).
- **Go Quality**: `gofmt -s -w .`, `git diff --check`, `go vet`, `go mod tidy` clean.
- **Frontend Tests**: `npm run test` passed (42/42 tests passing across 5 test suites).
- **Frontend Quality**: `npm run lint`, `npm run typecheck`, `npm run build` green.
- **OpenAPI**: `GOWORK=off go run ./cmd/openapi-gen` verified 0 semantic diff against `docs/api/admin/openapi.json`.
- **Fresh Clone**: Tested in isolated directory outside repository tree; all tests and builds passed cleanly.
- **Docker**: `matjero-admin-api` (`docker/go-app.Dockerfile`) and `matjero-admin-web` (`docker/web-app.Dockerfile`) built successfully.
- **Security**: OIDC PKCE authentication, RolePlatformAdmin role checks, and secret field privacy intact.

## 13. Final Action Lifecycle and Transport Bound Hardening

### Overview
- **PR #4 Merge SHA**: `c611db032a35096663e0013f5211b943d582428a`
- **PR #5 Merge SHA**: `5c6d0b53f4118774fa96ce01a1a45605dbdfb390`
- **Base SHA**: `5c6d0b53f4118774fa96ce01a1a45605dbdfb390`
- **Core Dependency SHA**: `96cf98e5a1f1de3f388a86e316b5b59414d49d11`
- **Hardening Branch**: `fix/admin-domain-moderation-action-lifecycle`

### Technical Fixes & Enhancements
1. **Per-Domain Action State (`actionInFlightDomainIds`)**:
   - Replaced single string `actionInFlightDomainId` with a `Set<string>` state.
   - Supports multiple simultaneous domain moderation actions.
   - At action start, adds `domain.id` to `actionInFlightDomainIds`.
   - In `finally` block, unconditionally deletes `domain.id` from `actionInFlightDomainIds` (not generation-guarded) so stale actions always release their own in-flight marker.
   - Added regression tests for two concurrent domain actions and stale action unlock upon returning to view.

2. **Synchronous View Invalidation (`invalidateView`)**:
   - Replaced passive `useEffect` view generation with synchronous `invalidateView()` calls inside user event handlers (`search`, `statusFilter`, `typeFilter`, `sellerFilter`, `storeFilter`, pagination prev/next, clear filters).
   - Keystroke in raw search input invalidates view generation immediately without waiting 300ms for debounced search.
   - Added regression test proving instant view staleness without passive effect dependency.

3. **Strict Core Response Size Bound (`maxResponseBytes+1`)**:
   - Updated shared `coreclient` response reader to use `io.LimitReader(resp.Body, maxResponseBytes+1)`.
   - Explicitly rejects any payload exceeding `maxResponseBytes` with a wrapped `ErrUnavailable` error before decoding JSON.
   - Added `TestClientRejectsValidJSONWithOversizedWhitespace` proving rejection of valid JSON followed by trailing whitespace exceeding 8 MiB.

4. **Complete Verification Privacy Assertion**:
   - Expanded forbidden privacy fields in `internal/adminapi/domains_test.go` to include `verification_token`, `verification`, `record_value`, and `challenge`.
   - Standardized privacy assertions on raw body using standard library `bytes.Contains`.

5. **Search-Debounce View Transition Fix**:
   - Added `debouncedSearchRef` tracking committed server-side search state.
   - When the 300ms search timer fires and `search != debouncedSearchRef.current`, `invalidateView()` is invoked BEFORE applying `setDebouncedSearch(search)`.
   - Ensures actions initiated during the 300ms search debounce window are marked stale when the server-side search view commits, preventing pre-search view resurrection.
   - Added deterministic regression test using fake timers and deferred promises.

