package coreclient

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/matjeroapps/admin/internal/httpx"
)

// These tests exercise the client against a local stub Core server. They need no
// PostgreSQL, no Core checkout and no Core module: that is the point of the
// Repository Independence Rule.

const (
	testToken   = "seller-service-token"
	testService = "seller"
)

// stubCore is a local stand-in for the Core internal API.
type stubCore struct {
	server *httptest.Server
	// last records the most recent request for assertion.
	last *http.Request
	// lastBody captures the request body, which is unreadable once the handler
	// returns.
	lastBody []byte
	// handler overrides the default 200/{} response.
	handler func(w http.ResponseWriter, r *http.Request)
}

func newStubCore(t *testing.T, handler func(w http.ResponseWriter, r *http.Request)) *stubCore {
	t.Helper()
	stub := &stubCore{handler: handler}
	stub.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		stub.last = r
		if r.Body != nil {
			body, _ := io.ReadAll(io.LimitReader(r.Body, 1<<20))
			stub.lastBody = body
		}
		if stub.handler != nil {
			stub.handler(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{}`))
	}))
	t.Cleanup(stub.server.Close)
	return stub
}

func (s *stubCore) client(t *testing.T) *Client {
	t.Helper()
	client, err := New(Config{
		BaseURL: s.server.URL,
		Token:   testToken,
		Service: testService,
	})
	if err != nil {
		t.Fatalf("build client: %v", err)
	}
	return client
}

func jsonHandler(status int, body string) func(http.ResponseWriter, *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}
}

// --- construction ---

func TestNewRejectsUnusableConfig(t *testing.T) {
	cases := []struct {
		name   string
		config Config
	}{
		{"empty base URL", Config{Token: testToken, Service: testService}},
		{"unparsable base URL", Config{BaseURL: "http://[::1]:namedport", Token: testToken, Service: testService}},
		{"non-http scheme", Config{BaseURL: "ftp://core", Token: testToken, Service: testService}},
		{"missing host", Config{BaseURL: "http://", Token: testToken, Service: testService}},
		{"missing token", Config{BaseURL: "http://core-api:8080", Service: testService}},
		{"missing service", Config{BaseURL: "http://core-api:8080", Token: testToken}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := New(tc.config); err == nil {
				t.Fatal("expected New to fail")
			}
		})
	}
}

func TestNewAcceptsValidConfig(t *testing.T) {
	if _, err := New(Config{BaseURL: "http://core-api:8080", Token: testToken, Service: testService}); err != nil {
		t.Fatalf("New: %v", err)
	}
}

// --- service authentication ---

func TestClientSendsServiceCredentials(t *testing.T) {
	stub := newStubCore(t, nil)
	client := stub.client(t)

	if err := client.get(context.Background(), "/internal/v1/markets", nil, requestOptions{}, nil); err != nil {
		t.Fatalf("get: %v", err)
	}

	if got := stub.last.Header.Get("Authorization"); got != "Bearer "+testToken {
		t.Errorf("Authorization = %q, want the bearer token", got)
	}
	if got := stub.last.Header.Get(HeaderService); got != testService {
		t.Errorf("%s = %q, want %q", HeaderService, got, testService)
	}
	if got := stub.last.Header.Get("Accept"); got != "application/json" {
		t.Errorf("Accept = %q, want application/json", got)
	}
}

// A client-supplied copy of an internal header must never survive into the Core
// request. The client sets these headers itself; it never appends.
func TestClientOverwritesInternalHeaders(t *testing.T) {
	stub := newStubCore(t, nil)
	client := stub.client(t)

	// Simulate a request context that already carries hostile values, as would
	// happen if a browser sent them and the caller failed to strip them.
	ctx := context.Background()
	if err := client.get(ctx, "/internal/v1/markets", nil, requestOptions{
		Subject:        "trusted-subject",
		StorefrontHost: "trusted.example.com",
	}, nil); err != nil {
		t.Fatalf("get: %v", err)
	}

	if got := stub.last.Header.Get(HeaderSubject); got != "trusted-subject" {
		t.Errorf("%s = %q, want the trusted value", HeaderSubject, got)
	}
	if got := stub.last.Header.Get(HeaderStorefrontHost); got != "trusted.example.com" {
		t.Errorf("%s = %q, want the trusted value", HeaderStorefrontHost, got)
	}
	// Exactly one value each: Set, never Add.
	if n := len(stub.last.Header.Values(HeaderSubject)); n != 1 {
		t.Errorf("%s sent %d values, want 1", HeaderSubject, n)
	}
}

func TestClientOmitsEmptyOptionalHeaders(t *testing.T) {
	stub := newStubCore(t, nil)
	client := stub.client(t)

	if err := client.get(context.Background(), "/internal/v1/markets", nil, requestOptions{}, nil); err != nil {
		t.Fatalf("get: %v", err)
	}

	if _, ok := stub.last.Header[HeaderSubject]; ok {
		t.Errorf("%s must be omitted when there is no subject", HeaderSubject)
	}
	if _, ok := stub.last.Header[HeaderStorefrontHost]; ok {
		t.Errorf("%s must be omitted when there is no host", HeaderStorefrontHost)
	}
}

// --- error mapping ---

func TestClientMapsCoreErrorCodes(t *testing.T) {
	cases := []struct {
		code       string
		wantStatus int
	}{
		{CodeNotFound, http.StatusNotFound},
		{CodeStorefrontUnavailable, http.StatusNotFound},
		{CodeValidationError, http.StatusBadRequest},
		{CodeInvalidArgument, http.StatusBadRequest},
		{CodeSchemaMismatch, http.StatusBadRequest},
		{CodeUnsafeContent, http.StatusBadRequest},
		{CodeUnauthorized, http.StatusUnauthorized},
		{CodeForbidden, http.StatusForbidden},
		{CodeConflict, http.StatusConflict},
		{CodeMarketMismatch, http.StatusConflict},
		{CodeInsufficientInventory, http.StatusConflict},
		{CodeUnavailable, http.StatusServiceUnavailable},
		{CodePreviewUnavailable, http.StatusServiceUnavailable},
		{CodeInternalError, http.StatusInternalServerError},
	}

	for _, tc := range cases {
		t.Run(tc.code, func(t *testing.T) {
			stub := newStubCore(t, jsonHandler(tc.wantStatus, `{"error":{"code":"`+tc.code+`","message":"boom"}}`))
			client := stub.client(t)

			err := client.get(context.Background(), "/internal/v1/markets", nil, requestOptions{}, nil)
			if err == nil {
				t.Fatal("expected an error")
			}
			var coreErr *Error
			if !asError(err, &coreErr) {
				t.Fatalf("error is not a *coreclient.Error: %T %v", err, err)
			}
			if coreErr.Code != tc.code {
				t.Errorf("code = %q, want %q", coreErr.Code, tc.code)
			}
			if coreErr.Status != tc.wantStatus {
				t.Errorf("status = %d, want %d", coreErr.Status, tc.wantStatus)
			}
		})
	}
}

// An unrecognizable error body must still produce a typed error, so no caller
// ever has to interpret a bare status code.
func TestClientHandlesMalformedErrorBody(t *testing.T) {
	stub := newStubCore(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte(`<html>upstream failure</html>`))
	})
	client := stub.client(t)

	err := client.get(context.Background(), "/internal/v1/markets", nil, requestOptions{}, nil)
	var coreErr *Error
	if !asError(err, &coreErr) {
		t.Fatalf("expected a *coreclient.Error, got %T %v", err, err)
	}
	if coreErr.Code != CodeInternalError {
		t.Errorf("code = %q, want %q", coreErr.Code, CodeInternalError)
	}
	if coreErr.Status != http.StatusBadGateway {
		t.Errorf("status = %d, want %d", coreErr.Status, http.StatusBadGateway)
	}
}

func TestClientHandlesUnexpectedStatusWithoutBody(t *testing.T) {
	stub := newStubCore(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})
	client := stub.client(t)

	err := client.get(context.Background(), "/internal/v1/markets", nil, requestOptions{}, nil)
	var coreErr *Error
	if !asError(err, &coreErr) {
		t.Fatalf("expected a *coreclient.Error, got %T %v", err, err)
	}
	if coreErr.Code != CodeInternalError {
		t.Errorf("code = %q, want %q", coreErr.Code, CodeInternalError)
	}
}

// --- transport failure ---

func TestClientReportsUnavailableWhenCoreIsUnreachable(t *testing.T) {
	// A closed server: connection refused.
	stub := newStubCore(t, nil)
	client := stub.client(t)
	stub.server.Close()

	err := client.get(context.Background(), "/internal/v1/markets", nil, requestOptions{}, nil)
	if err == nil {
		t.Fatal("expected an error")
	}
	if !isUnavailable(err) {
		t.Errorf("expected ErrUnavailable, got %v", err)
	}
}

func TestClientHonoursContextCancellation(t *testing.T) {
	stub := newStubCore(t, func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(500 * time.Millisecond)
	})
	client := stub.client(t)

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()

	err := client.get(ctx, "/internal/v1/markets", nil, requestOptions{}, nil)
	if err == nil {
		t.Fatal("expected a timeout error")
	}
	if !isUnavailable(err) {
		t.Errorf("expected ErrUnavailable on timeout, got %v", err)
	}
}

func TestClientHonoursExplicitTimeout(t *testing.T) {
	stub := newStubCore(t, func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(500 * time.Millisecond)
	})
	client, err := New(Config{
		BaseURL: stub.server.URL,
		Token:   testToken,
		Service: testService,
		Timeout: 20 * time.Millisecond,
	})
	if err != nil {
		t.Fatalf("build client: %v", err)
	}

	if err := client.get(context.Background(), "/internal/v1/markets", nil, requestOptions{}, nil); err == nil {
		t.Fatal("expected the configured timeout to abort the call")
	}
}

// --- response validation ---

func TestClientRejectsNonJSONContentType(t *testing.T) {
	stub := newStubCore(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		_, _ = w.Write([]byte(`<html>not core</html>`))
	})
	client := stub.client(t)

	err := client.get(context.Background(), "/internal/v1/markets", nil, requestOptions{}, nil)
	if err == nil {
		t.Fatal("expected a non-JSON response to be rejected")
	}
	if !isUnavailable(err) {
		t.Errorf("expected ErrUnavailable, got %v", err)
	}
}

func TestClientRejectsMalformedSuccessBody(t *testing.T) {
	stub := newStubCore(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"markets": [ this is not json`))
	})
	client := stub.client(t)

	var payload MarketsResponse
	err := client.get(context.Background(), "/internal/v1/markets", nil, requestOptions{}, &payload)
	if err == nil {
		t.Fatal("expected a malformed body to be rejected")
	}
	if !isUnavailable(err) {
		t.Errorf("expected ErrUnavailable, got %v", err)
	}
}

// A hostile or broken Core must not be able to exhaust Seller's memory.
func TestClientBoundsResponseSize(t *testing.T) {
	stub := newStubCore(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"markets":[`))
		chunk := strings.Repeat(`{"code":"EG"},`, 1024)
		for i := 0; i < 20000; i++ {
			if _, err := w.Write([]byte(chunk)); err != nil {
				return
			}
		}
		_, _ = w.Write([]byte(`{"code":"EG"}]}`))
	})
	client := stub.client(t)

	var payload MarketsResponse
	// The read is bounded, so this must fail rather than allocate without limit.
	if err := client.get(context.Background(), "/internal/v1/markets", nil, requestOptions{}, &payload); err == nil {
		t.Fatal("expected an oversized response to be rejected")
	}
}

// --- request encoding ---

func TestClientSendsJSONBodyAndContentType(t *testing.T) {
	stub := newStubCore(t, nil)
	client := stub.client(t)

	if err := client.post(context.Background(), "/internal/v1/suppliers/sup-1/status", StatusUpdate{Status: "suspended"}, requestOptions{}, nil); err != nil {
		t.Fatalf("post: %v", err)
	}

	if got := stub.last.Header.Get("Content-Type"); got != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", got)
	}
	var body StatusUpdate
	if err := json.Unmarshal(stub.lastBody, &body); err != nil {
		t.Fatalf("decode sent body: %v", err)
	}
	if body.Status != "suspended" {
		t.Errorf("sent body = %+v, want the encoded payload", body)
	}
}

// contextWithCorrelation runs a request through the real httpx middleware chain
// and returns the resulting context, so the test observes the same correlation
// values production code would see.
func contextWithCorrelation(t *testing.T, correlationID string) context.Context {
	t.Helper()

	var captured context.Context
	router := httpx.NewRouter(httpx.App{Config: httpx.Config{ServiceName: "test"}})
	router.Get("/probe", func(w http.ResponseWriter, r *http.Request) {
		captured = r.Context()
	})

	req := httptest.NewRequest(http.MethodGet, "/probe", nil)
	req.Header.Set("X-Correlation-Id", correlationID)
	router.ServeHTTP(httptest.NewRecorder(), req)

	if captured == nil {
		t.Fatal("probe handler did not run")
	}
	return captured
}

func TestClientPropagatesCorrelationIDs(t *testing.T) {
	stub := newStubCore(t, nil)
	client := stub.client(t)

	ctx := contextWithCorrelation(t, "corr-456")
	if err := client.get(ctx, "/internal/v1/markets", nil, requestOptions{}, nil); err != nil {
		t.Fatalf("get: %v", err)
	}

	if want := httpx.RequestID(ctx); want != "" {
		if got := stub.last.Header.Get(HeaderRequestID); got != want {
			t.Errorf("%s = %q, want the propagated request id %q", HeaderRequestID, got, want)
		}
	}
	if got := stub.last.Header.Get(HeaderCorrelationID); got != "corr-456" {
		t.Errorf("%s = %q, want corr-456", HeaderCorrelationID, got)
	}
}

// asError reports whether err wraps a *coreclient.Error.
func asError(err error, target **Error) bool {
	return errors.As(err, target)
}

// isUnavailable reports whether err is the sentinel transport failure.
func isUnavailable(err error) bool {
	return errors.Is(err, ErrUnavailable)
}

func TestClientBuildsAbsoluteURLFromBasePath(t *testing.T) {
	stub := newStubCore(t, nil)
	client := stub.client(t)

	if err := client.get(context.Background(), "/internal/v1/markets/EG", nil, requestOptions{}, nil); err != nil {
		t.Fatalf("get: %v", err)
	}
	if got := stub.last.URL.Path; got != "/internal/v1/markets/EG" {
		t.Errorf("path = %q, want /internal/v1/markets/EG", got)
	}
}

func TestClientForwardsLocale(t *testing.T) {
	stub := newStubCore(t, nil)
	client := stub.client(t)

	if err := client.get(context.Background(), "/internal/v1/markets", nil, requestOptions{Locale: "ar"}, nil); err != nil {
		t.Fatalf("get: %v", err)
	}
	if got := stub.last.URL.Query().Get("locale"); got != "ar" {
		t.Errorf("locale = %q, want ar", got)
	}
}
