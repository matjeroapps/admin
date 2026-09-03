# Technical Implementation Report — Stage C1 Admin Domain Moderation

## 1. Governance & Metadata
- **Branch**: `feature/admin-domain-moderation`
- **Base SHA**: `5b9d16c26a52c4faa0cd7193d975841cb1ecde7f`
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
