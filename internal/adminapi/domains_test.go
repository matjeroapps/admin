package adminapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/matjeroapps/admin/internal/auth"
	"github.com/matjeroapps/admin/internal/coreclient"
)

func TestAdminDomainsListForwarding(t *testing.T) {
	now := time.Now()
	core := &stubCore{
		domains: []coreclient.StoreDomain{
			{
				ID:            "dom-1",
				StoreID:       "str-1",
				Domain:        "store.example.com",
				IsPrimary:     true,
				VerifiedAt:    &now,
				Status:        "active",
				DomainType:    "custom",
				LastCheckedAt: &now,
				CreatedAt:     now,
				UpdatedAt:     now,
			},
		},
	}
	handler := newHandler(core)

	rec := doRequest(t, handler, http.MethodGet, "/v1/admin/domains?store_id=str-1&seller_id=sel-1&status=active&domain_type=custom&search=store&limit=10&offset=5", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %q)", rec.Code, rec.Body.String())
	}

	if core.domainFilter.StoreID != "str-1" || core.domainFilter.SellerID != "sel-1" ||
		core.domainFilter.Status != "active" || core.domainFilter.DomainType != "custom" ||
		core.domainFilter.Search != "store" || core.domainFilter.Page.Limit != 10 || core.domainFilter.Page.Offset != 5 {
		t.Errorf("unexpected forwarded filter: %+v", core.domainFilter)
	}

	// Capture raw body bytes before decoding payload
	raw := append([]byte(nil), rec.Body.Bytes()...)

	var payload struct {
		Items []coreclient.StoreDomain `json:"items"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		t.Fatalf("decode JSON payload: %v", err)
	}

	if len(payload.Items) != 1 || payload.Items[0].ID != "dom-1" {
		t.Fatalf("unexpected response items: %+v", payload.Items)
	}

	// Verify secret fields privacy on raw body
	for _, secretField := range []string{"verification_token", "record_value", "challenge"} {
		if stringContains(string(raw), secretField) {
			t.Errorf("response leaked sensitive secret field %q: %s", secretField, string(raw))
		}
	}
}

func TestAdminDisableDomainRoute(t *testing.T) {
	core := &stubCore{
		domain: coreclient.StoreDomain{
			ID:         "dom-1",
			StoreID:    "str-1",
			Domain:     "store.example.com",
			IsPrimary:  false,
			Status:     "disabled",
			DomainType: "custom",
		},
	}
	handler := newHandler(core)

	rec := doRequest(t, handler, http.MethodPost, "/v1/admin/domains/dom-1/disable", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %q)", rec.Code, rec.Body.String())
	}

	if core.id != "dom-1" {
		t.Errorf("forwarded domain id = %q, want dom-1", core.id)
	}

	var domain coreclient.StoreDomain
	if err := json.NewDecoder(rec.Body).Decode(&domain); err != nil {
		t.Fatalf("decode domain: %v", err)
	}
	if domain.Status != "disabled" {
		t.Errorf("unexpected domain status: %s", domain.Status)
	}
}

func TestAdminEnableDomainRoute(t *testing.T) {
	core := &stubCore{
		domain: coreclient.StoreDomain{
			ID:         "dom-1",
			StoreID:    "str-1",
			Domain:     "store.example.com",
			IsPrimary:  false,
			Status:     "verified",
			DomainType: "custom",
		},
	}
	handler := newHandler(core)

	rec := doRequest(t, handler, http.MethodPost, "/v1/admin/domains/dom-1/enable", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %q)", rec.Code, rec.Body.String())
	}

	if core.id != "dom-1" {
		t.Errorf("forwarded domain id = %q, want dom-1", core.id)
	}

	var domain coreclient.StoreDomain
	if err := json.NewDecoder(rec.Body).Decode(&domain); err != nil {
		t.Fatalf("decode domain: %v", err)
	}
	if domain.Status != "verified" {
		t.Errorf("unexpected domain status: %s", domain.Status)
	}
}

func TestAdminDomainErrorMapping(t *testing.T) {
	t.Run("404 not found", func(t *testing.T) {
		core := &stubCore{err: &coreclient.Error{Status: http.StatusNotFound, Code: coreclient.CodeNotFound}}
		handler := newHandler(core)

		rec := doRequest(t, handler, http.MethodPost, "/v1/admin/domains/missing/disable", "")
		if rec.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404", rec.Code)
		}
		if got := decodeError(t, rec); got != "not_found" {
			t.Errorf("error code = %q, want not_found", got)
		}
	})

	t.Run("409 conflict", func(t *testing.T) {
		core := &stubCore{err: &coreclient.Error{Status: http.StatusConflict, Code: coreclient.CodeConflict}}
		handler := newHandler(core)

		rec := doRequest(t, handler, http.MethodPost, "/v1/admin/domains/dom-1/enable", "")
		if rec.Code != http.StatusConflict {
			t.Fatalf("status = %d, want 409", rec.Code)
		}
		if got := decodeError(t, rec); got != "conflict" {
			t.Errorf("error code = %q, want conflict", got)
		}
	})
}

type fakeVerifier struct {
	principal auth.Principal
	err       error
}

func (f fakeVerifier) Verify(ctx context.Context, token string) (auth.Principal, error) {
	if f.err != nil {
		return auth.Principal{}, f.err
	}
	return f.principal, nil
}

func TestAdminDomainsAuthRegression(t *testing.T) {
	core := &stubCore{
		domains: []coreclient.StoreDomain{},
	}

	t.Run("no token -> 401", func(t *testing.T) {
		r := chi.NewRouter()
		r.Use(auth.Middleware(fakeVerifier{err: auth.Unauthorized("missing bearer token")}))
		r.Use(auth.RequireAnyRole(auth.RolePlatformAdmin))
		r.Route("/v1", func(r chi.Router) {
			RegisterAdminRoutes(Dependencies{Core: core})(r)
		})

		req := httptest.NewRequest(http.MethodGet, "/v1/admin/domains", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401 Unauthorized, got %d", rec.Code)
		}
	})

	t.Run("valid user without platform_admin -> 403", func(t *testing.T) {
		r := chi.NewRouter()
		r.Use(auth.Middleware(fakeVerifier{principal: auth.Principal{Subject: "user-seller", Roles: []string{"seller_owner"}}}))
		r.Use(auth.RequireAnyRole(auth.RolePlatformAdmin))
		r.Route("/v1", func(r chi.Router) {
			RegisterAdminRoutes(Dependencies{Core: core})(r)
		})

		req := httptest.NewRequest(http.MethodGet, "/v1/admin/domains", nil)
		req.Header.Set("Authorization", "Bearer valid-token")
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusForbidden {
			t.Fatalf("expected 403 Forbidden, got %d", rec.Code)
		}
	})

	t.Run("platform_admin -> 200 success", func(t *testing.T) {
		r := chi.NewRouter()
		r.Use(auth.Middleware(fakeVerifier{principal: auth.Principal{Subject: "user-admin", Roles: []string{auth.RolePlatformAdmin}}}))
		r.Use(auth.RequireAnyRole(auth.RolePlatformAdmin))
		r.Route("/v1", func(r chi.Router) {
			RegisterAdminRoutes(Dependencies{Core: core})(r)
		})

		req := httptest.NewRequest(http.MethodGet, "/v1/admin/domains", nil)
		req.Header.Set("Authorization", "Bearer admin-token")
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rec.Code)
		}
	})
}

func stringContains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsSubstr(s, substr))
}

func containsSubstr(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
