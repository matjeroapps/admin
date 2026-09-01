package adminapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"github.com/matjeroapps/admin/internal/auth"
	"github.com/matjeroapps/admin/internal/coreclient"
	"github.com/matjeroapps/admin/internal/i18n"
)

// These tests prove the Admin API's transport and BFF behaviour against a local
// stub Core. They need no PostgreSQL, no Core migrations and no Core module:
// business correctness is Core's responsibility and is tested there.

// stubCore records the calls the handlers make and returns canned results.
type stubCore struct {
	// page records the forwarded pagination window.
	page coreclient.Page
	// filter records the forwarded filter value (market code, store id, supplier
	// id) so query forwarding is observable.
	filter string
	// id records the identifier the last status mutation addressed.
	id string
	// status records the status the last mutation applied.
	status string

	err error

	counts     map[string]int
	suppliers  []coreclient.Supplier
	sellers    []coreclient.Seller
	stores     []coreclient.Store
	products   []coreclient.Product
	categories []coreclient.Category
	offers     []coreclient.SupplierCatalogItem
	listings   []coreclient.SellerListing
	locations  []coreclient.FulfillmentLocation
}

func (s *stubCore) GetOverview(ctx context.Context) (map[string]int, error) {
	return s.counts, s.err
}

func (s *stubCore) ListSuppliers(ctx context.Context, page coreclient.Page) ([]coreclient.Supplier, error) {
	s.page = page
	return s.suppliers, s.err
}

func (s *stubCore) UpdateSupplierStatus(ctx context.Context, supplierID, status string) error {
	s.id, s.status = supplierID, status
	return s.err
}

func (s *stubCore) ListSellers(ctx context.Context, page coreclient.Page) ([]coreclient.Seller, error) {
	s.page = page
	return s.sellers, s.err
}

func (s *stubCore) UpdateSellerStatus(ctx context.Context, sellerID, status string) error {
	s.id, s.status = sellerID, status
	return s.err
}

func (s *stubCore) ListStores(ctx context.Context, page coreclient.Page) ([]coreclient.Store, error) {
	s.page = page
	return s.stores, s.err
}

func (s *stubCore) UpdateStoreStatus(ctx context.Context, storeID, status string) error {
	s.id, s.status = storeID, status
	return s.err
}

func (s *stubCore) ListProducts(ctx context.Context, page coreclient.Page) ([]coreclient.Product, error) {
	s.page = page
	return s.products, s.err
}

func (s *stubCore) UpdateProductStatus(ctx context.Context, productID, status string) error {
	s.id, s.status = productID, status
	return s.err
}

func (s *stubCore) ListCategories(ctx context.Context, page coreclient.Page) ([]coreclient.Category, error) {
	s.page = page
	return s.categories, s.err
}

func (s *stubCore) UpdateCategoryStatus(ctx context.Context, categoryID, status string) error {
	s.id, s.status = categoryID, status
	return s.err
}

func (s *stubCore) ListOffers(ctx context.Context, marketCode string, page coreclient.Page) ([]coreclient.SupplierCatalogItem, error) {
	s.filter, s.page = marketCode, page
	return s.offers, s.err
}

func (s *stubCore) UpdateOfferStatus(ctx context.Context, offerID, status string) error {
	s.id, s.status = offerID, status
	return s.err
}

func (s *stubCore) ListListings(ctx context.Context, storeID string, page coreclient.Page) ([]coreclient.SellerListing, error) {
	s.filter, s.page = storeID, page
	return s.listings, s.err
}

func (s *stubCore) UpdateListingStatus(ctx context.Context, listingID, status string) error {
	s.id, s.status = listingID, status
	return s.err
}

func (s *stubCore) ListLocations(ctx context.Context, supplierID string, page coreclient.Page) ([]coreclient.FulfillmentLocation, error) {
	s.filter, s.page = supplierID, page
	return s.locations, s.err
}

func (s *stubCore) UpdateLocationStatus(ctx context.Context, locationID, status string) error {
	s.id, s.status = locationID, status
	return s.err
}

// newHandler builds the admin routes behind an authenticated platform admin.
func newHandler(core CoreCapabilities) http.Handler {
	router := chi.NewRouter()
	router.Use(i18n.Middleware(i18n.Default()))
	router.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			next.ServeHTTP(w, r.WithContext(auth.WithPrincipal(r.Context(), auth.Principal{
				Subject: "admin-subject",
				Roles:   []string{auth.RolePlatformAdmin},
			})))
		})
	})
	router.Route("/v1", func(r chi.Router) {
		RegisterAdminRoutes(Dependencies{Core: core})(r)
	})
	return router
}

func doRequest(t *testing.T, handler http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func decodeError(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var payload struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode error envelope: %v (body %q)", err, rec.Body.String())
	}
	return payload.Error.Code
}

// --- request mapping ---

func TestAdminMapsPagination(t *testing.T) {
	core := &stubCore{}
	handler := newHandler(core)

	doRequest(t, handler, http.MethodGet, "/v1/admin/suppliers?limit=10&offset=20", "")

	if core.page.Limit != 10 || core.page.Offset != 20 {
		t.Fatalf("forwarded page = %+v, want limit 10 offset 20", core.page)
	}
}

func TestAdminClampsPagination(t *testing.T) {
	core := &stubCore{}
	handler := newHandler(core)

	doRequest(t, handler, http.MethodGet, "/v1/admin/suppliers?limit=9999&offset=-5", "")

	if core.page.Limit != 25 {
		t.Errorf("limit = %d, want the default 25 when above the maximum", core.page.Limit)
	}
	if core.page.Offset != 0 {
		t.Errorf("offset = %d, want 0 when negative", core.page.Offset)
	}
}

func TestAdminForwardsMarketFilter(t *testing.T) {
	core := &stubCore{}
	handler := newHandler(core)

	doRequest(t, handler, http.MethodGet, "/v1/admin/offers?market_code=EG", "")

	if core.filter != "EG" {
		t.Fatalf("forwarded market filter = %q, want EG", core.filter)
	}
}

func TestAdminForwardsStoreFilter(t *testing.T) {
	core := &stubCore{}
	handler := newHandler(core)

	doRequest(t, handler, http.MethodGet, "/v1/admin/listings?store_id=store-1", "")

	if core.filter != "store-1" {
		t.Fatalf("forwarded store filter = %q, want store-1", core.filter)
	}
}

func TestAdminForwardsSupplierFilter(t *testing.T) {
	core := &stubCore{}
	handler := newHandler(core)

	doRequest(t, handler, http.MethodGet, "/v1/admin/locations?supplier_id=supplier-1", "")

	if core.filter != "supplier-1" {
		t.Fatalf("forwarded supplier filter = %q, want supplier-1", core.filter)
	}
}

// --- status mutations ---

func TestAdminStatusMutationsForwardIDAndStatus(t *testing.T) {
	cases := []struct {
		name string
		path string
	}{
		{"supplier", "/v1/admin/suppliers/sup-1/status"},
		{"seller", "/v1/admin/sellers/sel-1/status"},
		{"store", "/v1/admin/stores/sto-1/status"},
		{"product", "/v1/admin/products/pro-1/status"},
		{"category", "/v1/admin/categories/cat-1/status"},
		{"offer", "/v1/admin/offers/off-1/status"},
		{"listing", "/v1/admin/listings/lis-1/status"},
		{"location", "/v1/admin/locations/loc-1/status"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			core := &stubCore{}
			handler := newHandler(core)

			rec := doRequest(t, handler, http.MethodPost, tc.path, `{"status":"suspended"}`)

			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d (body %q)", rec.Code, rec.Body.String())
			}
			if core.status != "suspended" {
				t.Errorf("forwarded status = %q, want suspended", core.status)
			}
			if !strings.HasSuffix(core.id, "-1") {
				t.Errorf("forwarded id = %q, want the path identifier", core.id)
			}
			// The response echoes the applied status.
			var payload struct {
				Status string `json:"status"`
			}
			if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
				t.Fatalf("decode: %v", err)
			}
			if payload.Status != "suspended" {
				t.Errorf("echoed status = %q, want suspended", payload.Status)
			}
		})
	}
}

func TestAdminRejectsInvalidJSON(t *testing.T) {
	core := &stubCore{}
	handler := newHandler(core)

	rec := doRequest(t, handler, http.MethodPost, "/v1/admin/suppliers/sup-1/status", `{"status":`)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (body %q)", rec.Code, rec.Body.String())
	}
	if got := decodeError(t, rec); got != "invalid_json" {
		t.Errorf("error code = %q, want invalid_json", got)
	}
}

// --- response mapping ---

func TestAdminMapsOverviewCounts(t *testing.T) {
	core := &stubCore{counts: map[string]int{"suppliers": 3, "sellers": 7}}
	handler := newHandler(core)

	rec := doRequest(t, handler, http.MethodGet, "/v1/admin/overview", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d (body %q)", rec.Code, rec.Body.String())
	}

	var payload struct {
		Counts map[string]int `json:"counts"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if payload.Counts["suppliers"] != 3 || payload.Counts["sellers"] != 7 {
		t.Errorf("counts = %+v, want suppliers 3 sellers 7", payload.Counts)
	}
}

func TestAdminMapsCollections(t *testing.T) {
	core := &stubCore{
		suppliers:  []coreclient.Supplier{{ID: "sup-1", Code: "supplier-a"}},
		sellers:    []coreclient.Seller{{ID: "sel-1", Code: "seller-a"}},
		stores:     []coreclient.Store{{ID: "sto-1", Code: "store-a"}},
		products:   []coreclient.Product{{ID: "pro-1", Slug: "lamp"}},
		categories: []coreclient.Category{{ID: "cat-1", Slug: "lighting"}},
		offers:     []coreclient.SupplierCatalogItem{{OfferID: "off-1"}},
		listings:   []coreclient.SellerListing{{ID: "lis-1"}},
		locations:  []coreclient.FulfillmentLocation{{ID: "loc-1"}},
	}
	handler := newHandler(core)

	for _, path := range []string{
		"/v1/admin/suppliers",
		"/v1/admin/sellers",
		"/v1/admin/stores",
		"/v1/admin/products",
		"/v1/admin/categories",
		"/v1/admin/offers",
		"/v1/admin/listings",
		"/v1/admin/locations",
	} {
		rec := doRequest(t, handler, http.MethodGet, path, "")
		if rec.Code != http.StatusOK {
			t.Fatalf("%s: status = %d (body %q)", path, rec.Code, rec.Body.String())
		}
		var payload struct {
			Items []json.RawMessage `json:"items"`
		}
		if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
			t.Fatalf("%s: decode: %v", path, err)
		}
		if len(payload.Items) != 1 {
			t.Errorf("%s: items = %d, want 1", path, len(payload.Items))
		}
	}
}

// --- public error mapping ---

func TestAdminMapsCoreErrorsToPublicResponses(t *testing.T) {
	cases := []struct {
		name       string
		code       string
		wantStatus int
		wantCode   string
	}{
		{"not found", coreclient.CodeNotFound, http.StatusNotFound, "not_found"},
		{"validation", coreclient.CodeValidationError, http.StatusBadRequest, "validation_error"},
		{"market mismatch", coreclient.CodeMarketMismatch, http.StatusConflict, "market_mismatch"},
		{"insufficient inventory", coreclient.CodeInsufficientInventory, http.StatusConflict, "insufficient_inventory"},
		{"conflict", coreclient.CodeConflict, http.StatusConflict, "conflict"},
		{"forbidden", coreclient.CodeForbidden, http.StatusForbidden, "forbidden"},
		{"internal", coreclient.CodeInternalError, http.StatusInternalServerError, "internal_error"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			core := &stubCore{err: &coreclient.Error{Status: tc.wantStatus, Code: tc.code}}
			handler := newHandler(core)

			rec := doRequest(t, handler, http.MethodGet, "/v1/admin/suppliers", "")

			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d (body %q)", rec.Code, tc.wantStatus, rec.Body.String())
			}
			if got := decodeError(t, rec); got != tc.wantCode {
				t.Errorf("error code = %q, want %q", got, tc.wantCode)
			}
		})
	}
}

func TestAdminReturns503WhenCoreUnavailable(t *testing.T) {
	core := &stubCore{err: coreclient.ErrUnavailable}
	handler := newHandler(core)

	rec := doRequest(t, handler, http.MethodGet, "/v1/admin/overview", "")

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503 (body %q)", rec.Code, rec.Body.String())
	}
	if got := decodeError(t, rec); got != "service_unavailable" {
		t.Errorf("error code = %q, want service_unavailable", got)
	}
	// The response must not leak the internal Core host or a transport detail.
	body := rec.Body.String()
	for _, leak := range []string{"connection refused", "core-api", "dial tcp"} {
		if strings.Contains(body, leak) {
			t.Errorf("response leaked transport detail %q: %s", leak, body)
		}
	}
}

func TestAdminReturns503OnCoreTimeout(t *testing.T) {
	core := &stubCore{err: context.DeadlineExceeded}
	handler := newHandler(core)

	rec := doRequest(t, handler, http.MethodGet, "/v1/admin/overview", "")

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503 (body %q)", rec.Code, rec.Body.String())
	}
}
