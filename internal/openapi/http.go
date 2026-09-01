package openapi

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	httpSwagger "github.com/swaggo/http-swagger/v2"
)

type RouterConfig struct {
	Enabled   bool
	SpecPath  string
	DocsPath  string
	SpecBytes []byte
}

// Register registers the spec and docs routes directly on r.
//
// Prefer this over NewRouter for an application's root router. chi allows only
// one Mount at a given path, so mounting a docs sub-router at "/" makes a second
// Mount("/") for the application routes panic at startup.
func Register(r chi.Router, cfg RouterConfig) {
	if !cfg.Enabled {
		return
	}

	specPath, docsPath := paths(cfg)

	r.Get(specPath, specHandler(cfg.SpecBytes))
	swagger := httpSwagger.Handler(httpSwagger.URL(specPath))
	r.Get(docsPath, docsIndexHandler(swagger, docsPath))
	r.Handle(docsPath+"/*", swagger)
}

// NewRouter returns a standalone router serving the spec and docs. It is kept for
// callers that mount the docs under a non-root prefix.
func NewRouter(cfg RouterConfig) chi.Router {
	r := chi.NewRouter()
	Register(r, cfg)
	return r
}

func paths(cfg RouterConfig) (specPath, docsPath string) {
	specPath = cfg.SpecPath
	if specPath == "" {
		specPath = "/openapi.json"
	}

	docsPath = cfg.DocsPath
	if docsPath == "" {
		docsPath = "/docs"
	}
	return specPath, strings.TrimRight(docsPath, "/")
}

func specHandler(specBytes []byte) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(specBytes)
	}
}

func docsIndexHandler(swagger http.Handler, docsPath string) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		cloned := req.Clone(req.Context())
		cloned.RequestURI = docsPath + "/index.html"
		cloned.URL.Path = docsPath + "/index.html"
		swagger.ServeHTTP(w, cloned)
	}
}
