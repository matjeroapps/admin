package coreclient

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestListDomainsForwardingAndHeaders(t *testing.T) {
	stub := newStubCore(t, jsonHandler(http.StatusOK, `{
		"items": [
			{
				"id": "dom-1",
				"store_id": "str-1",
				"domain": "mystore.example.com",
				"is_primary": true,
				"status": "active",
				"domain_type": "custom",
				"created_at": "2026-01-01T00:00:00Z",
				"updated_at": "2026-01-01T00:00:00Z"
			}
		]
	}`))

	client := stub.client(t)
	filter := DomainFilter{
		StoreID:    "str-1",
		SellerID:   "sel-1",
		Status:     "active",
		DomainType: "custom",
		Search:     "mystore",
		Page:       Page{Limit: 10, Offset: 20},
	}

	domains, err := client.ListDomains(context.Background(), filter)
	if err != nil {
		t.Fatalf("ListDomains failed: %v", err)
	}

	if len(domains) != 1 || domains[0].ID != "dom-1" {
		t.Fatalf("unexpected domains result: %+v", domains)
	}

	req := stub.last
	if req.URL.Path != "/internal/v1/domains" {
		t.Errorf("unexpected path: %s", req.URL.Path)
	}

	q := req.URL.Query()
	if q.Get("store_id") != "str-1" || q.Get("seller_id") != "sel-1" || q.Get("status") != "active" ||
		q.Get("domain_type") != "custom" || q.Get("search") != "mystore" || q.Get("limit") != "10" || q.Get("offset") != "20" {
		t.Errorf("unexpected query params: %v", q)
	}

	if auth := req.Header.Get("Authorization"); auth != "Bearer "+testToken {
		t.Errorf("unexpected Authorization header: %s", auth)
	}
	if svc := req.Header.Get(HeaderService); svc != testService {
		t.Errorf("unexpected X-Matjero-Service header: %s", svc)
	}
}

func TestDisableDomainPathEscaping(t *testing.T) {
	stub := newStubCore(t, jsonHandler(http.StatusOK, `{
		"id": "dom/special ID?123",
		"store_id": "str-1",
		"domain": "test.matjero.shop",
		"is_primary": false,
		"status": "disabled",
		"domain_type": "platform",
		"created_at": "2026-01-01T00:00:00Z",
		"updated_at": "2026-01-01T00:00:00Z"
	}`))

	client := stub.client(t)
	rawID := "dom/special ID?123"

	domain, err := client.DisableDomain(context.Background(), rawID)
	if err != nil {
		t.Fatalf("DisableDomain failed: %v", err)
	}

	if domain.Status != "disabled" {
		t.Errorf("unexpected domain status: %s", domain.Status)
	}

	req := stub.last
	if req.Method != http.MethodPost {
		t.Errorf("expected POST method, got %s", req.Method)
	}
	expectedEscapedPath := "/internal/v1/domains/dom%2Fspecial%20ID%3F123/disable"
	if req.URL.EscapedPath() != expectedEscapedPath {
		t.Errorf("expected escaped path %s, got %s", expectedEscapedPath, req.URL.EscapedPath())
	}
}

func TestEnableDomainPathEscaping(t *testing.T) {
	stub := newStubCore(t, jsonHandler(http.StatusOK, `{
		"id": "dom-100",
		"store_id": "str-1",
		"domain": "custom.com",
		"is_primary": false,
		"status": "verified",
		"domain_type": "custom",
		"created_at": "2026-01-01T00:00:00Z",
		"updated_at": "2026-01-01T00:00:00Z"
	}`))

	client := stub.client(t)
	domain, err := client.EnableDomain(context.Background(), "dom-100")
	if err != nil {
		t.Fatalf("EnableDomain failed: %v", err)
	}

	if domain.Status != "verified" {
		t.Errorf("unexpected status: %s", domain.Status)
	}

	req := stub.last
	if req.Method != http.MethodPost {
		t.Errorf("expected POST method, got %s", req.Method)
	}
	if req.URL.Path != "/internal/v1/domains/dom-100/enable" {
		t.Errorf("unexpected path: %s", req.URL.Path)
	}
}

func TestDomainClientErrorHandling(t *testing.T) {
	t.Run("400 validation error", func(t *testing.T) {
		stub := newStubCore(t, jsonHandler(http.StatusBadRequest, `{"error":{"code":"validation_error","message":"invalid input"}}`))
		_, err := stub.client(t).ListDomains(context.Background(), DomainFilter{})
		var coreErr *Error
		if !asCoreError(err, &coreErr) || coreErr.Code != CodeValidationError || coreErr.Status != http.StatusBadRequest {
			t.Fatalf("expected validation_error 400, got: %v", err)
		}
	})

	t.Run("404 not found", func(t *testing.T) {
		stub := newStubCore(t, jsonHandler(http.StatusNotFound, `{"error":{"code":"not_found","message":"domain not found"}}`))
		_, err := stub.client(t).DisableDomain(context.Background(), "missing")
		var coreErr *Error
		if !asCoreError(err, &coreErr) || coreErr.Code != CodeNotFound || coreErr.Status != http.StatusNotFound {
			t.Fatalf("expected not_found 404, got: %v", err)
		}
	})

	t.Run("409 conflict", func(t *testing.T) {
		stub := newStubCore(t, jsonHandler(http.StatusConflict, `{"error":{"code":"conflict","message":"domain state changed"}}`))
		_, err := stub.client(t).EnableDomain(context.Background(), "dom-1")
		var coreErr *Error
		if !asCoreError(err, &coreErr) || coreErr.Code != CodeConflict || coreErr.Status != http.StatusConflict {
			t.Fatalf("expected conflict 409, got: %v", err)
		}
	})

	t.Run("503 unavailable", func(t *testing.T) {
		stub := newStubCore(t, jsonHandler(http.StatusServiceUnavailable, `{"error":{"code":"unavailable","message":"core down"}}`))
		_, err := stub.client(t).ListDomains(context.Background(), DomainFilter{})
		var coreErr *Error
		if !asCoreError(err, &coreErr) || coreErr.Code != CodeUnavailable {
			t.Fatalf("expected unavailable 503, got: %v", err)
		}
	})

	t.Run("timeout error", func(t *testing.T) {
		stub := newStubCore(t, func(w http.ResponseWriter, r *http.Request) {
			time.Sleep(50 * time.Millisecond)
		})
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
		defer cancel()
		_, err := stub.client(t).ListDomains(ctx, DomainFilter{})
		if err == nil || !strings.Contains(err.Error(), "core service unavailable") {
			t.Fatalf("expected core service unavailable on timeout, got: %v", err)
		}
	})

	t.Run("malformed response", func(t *testing.T) {
		stub := newStubCore(t, jsonHandler(http.StatusOK, `not json`))
		_, err := stub.client(t).ListDomains(context.Background(), DomainFilter{})
		if err == nil {
			t.Fatal("expected error on malformed JSON")
		}
	})

	t.Run("oversized response", func(t *testing.T) {
		largeBody := `{"items":[` + strings.Repeat(`{"id":"dom-1","store_id":"str-1","domain":"x.com","is_primary":false,"status":"active","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-01T00:00:00Z"},`, 60000) + `{"id":"dom-last","store_id":"str-1","domain":"last.com","is_primary":false,"status":"active","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-01T00:00:00Z"}]}`
		stub := newStubCore(t, jsonHandler(http.StatusOK, largeBody))
		_, err := stub.client(t).ListDomains(context.Background(), DomainFilter{})
		if err == nil {
			t.Fatal("expected error on oversized response exceeding maxResponseBytes")
		}
	})
}

func asCoreError(err error, target **Error) bool {
	if err == nil {
		return false
	}
	var e *Error
	if errors.As(err, &e) {
		*target = e
		return true
	}
	return false
}
