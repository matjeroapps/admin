package openapi

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

// The application entrypoints assemble a root router that carries health routes,
// the docs routes, and the versioned actor routes. chi permits only one Mount at
// a given path, so mounting the docs as a sub-router at "/" and then mounting the
// actor router at "/" panics at startup.
//
// That panic is not reachable from any package-level test of the routers in
// isolation, which is why it survived into built images. These tests assemble the
// same shape the entrypoints use.

func specBytesForTest(t *testing.T) []byte {
	t.Helper()
	spec, err := BuildDocument(DocumentSpec{
		Title:         "Router Assembly Test",
		Description:   "Minimal document used to exercise root router assembly.",
		Authenticated: true,
		Tags:          CommonTags(),
		Routes:        ActorRoutes(true),
	})
	if err != nil {
		t.Fatalf("build spec: %v", err)
	}
	specBytes, err := MarshalDocument(spec)
	if err != nil {
		t.Fatalf("marshal spec: %v", err)
	}
	return specBytes
}

// assembleRoot mirrors the entrypoint sequence: health routes, docs, then the
// versioned application routes mounted at the root.
func assembleRoot(t *testing.T, docsEnabled bool, specBytes []byte) chi.Router {
	t.Helper()

	root := chi.NewRouter()
	root.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	Register(root, RouterConfig{
		Enabled:   docsEnabled,
		SpecPath:  "/openapi.json",
		DocsPath:  "/docs",
		SpecBytes: specBytes,
	})

	application := chi.NewRouter()
	application.Route("/v1", func(r chi.Router) {
		r.Get("/probe", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusNoContent)
		})
	})
	root.Mount("/", application)

	return root
}

func status(t *testing.T, handler http.Handler, path string) int {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec.Code
}

// TestRootRouterAssemblyDoesNotPanic is the regression guard: assembling docs and
// application routes on one root router must not panic.
func TestRootRouterAssemblyDoesNotPanic(t *testing.T) {
	specBytes := specBytesForTest(t)

	for _, docsEnabled := range []bool{true, false} {
		func() {
			defer func() {
				if recovered := recover(); recovered != nil {
					t.Fatalf("root router assembly panicked (docs enabled=%v): %v", docsEnabled, recovered)
				}
			}()
			assembleRoot(t, docsEnabled, specBytes)
		}()
	}
}

// Every surface an entrypoint exposes must be reachable on the assembled router:
// health, docs, spec, and the versioned application routes.
func TestRootRouterServesHealthDocsAndApplicationRoutes(t *testing.T) {
	root := assembleRoot(t, true, specBytesForTest(t))

	cases := []struct {
		path string
		want int
	}{
		{"/healthz", http.StatusOK},
		{"/openapi.json", http.StatusOK},
		{"/docs", http.StatusOK},
		{"/v1/probe", http.StatusNoContent},
	}

	for _, tc := range cases {
		if got := status(t, root, tc.path); got != tc.want {
			t.Errorf("GET %s = %d, want %d", tc.path, got, tc.want)
		}
	}
}

// With docs disabled the spec must not be served, and the application routes must
// still work.
func TestRootRouterWithDocsDisabled(t *testing.T) {
	root := assembleRoot(t, false, specBytesForTest(t))

	if got := status(t, root, "/openapi.json"); got != http.StatusNotFound {
		t.Errorf("GET /openapi.json = %d, want 404 when docs are disabled", got)
	}
	if got := status(t, root, "/healthz"); got != http.StatusOK {
		t.Errorf("GET /healthz = %d, want 200", got)
	}
	if got := status(t, root, "/v1/probe"); got != http.StatusNoContent {
		t.Errorf("GET /v1/probe = %d, want 204", got)
	}
}

// Register must be usable more than once on sibling routers without interfering,
// which is what makes it safe for multiple applications in one repository.
func TestRegisterIsIndependentPerRouter(t *testing.T) {
	specBytes := specBytesForTest(t)

	first := assembleRoot(t, true, specBytes)
	second := assembleRoot(t, true, specBytes)

	if got := status(t, first, "/openapi.json"); got != http.StatusOK {
		t.Errorf("first router spec = %d, want 200", got)
	}
	if got := status(t, second, "/openapi.json"); got != http.StatusOK {
		t.Errorf("second router spec = %d, want 200", got)
	}
}
