// Command admin-api serves the Admin Platform HTTP surface.
//
// It owns request parsing, end-user authentication, and the public response
// contract. Every business capability is a Core-owned runtime call over the
// internal API (ADR-017); this service holds no database connection and imports
// no Core Go package.
package main

import (
	"context"
	"log"

	"github.com/go-chi/chi/v5"

	"github.com/matjeroapps/admin/internal/actorapi"
	"github.com/matjeroapps/admin/internal/adminapi"
	"github.com/matjeroapps/admin/internal/auth"
	"github.com/matjeroapps/admin/internal/config"
	"github.com/matjeroapps/admin/internal/coreclient"
	"github.com/matjeroapps/admin/internal/httpx"
	"github.com/matjeroapps/admin/internal/logging"
	"github.com/matjeroapps/admin/internal/observability"
	"github.com/matjeroapps/admin/internal/openapi"
)

func main() {
	if err := run(context.Background()); err != nil {
		log.Fatal(err)
	}
}

func run(ctx context.Context) error {
	cfg, err := config.Load("admin-api")
	if err != nil {
		return err
	}

	logger := logging.New(cfg)
	shutdown, err := observability.Init(ctx, cfg)
	if err != nil {
		return err
	}
	defer func() { _ = shutdown(context.Background()) }()

	core, err := coreclient.New(coreclient.Config{
		BaseURL: cfg.CoreAPIBaseURL,
		Token:   cfg.CoreAPIToken,
		Service: "admin",
		Timeout: cfg.CoreAPITimeout,
	})
	if err != nil {
		return err
	}

	verifier, err := auth.NewOIDCVerifier(ctx, auth.Config{
		IssuerURL:  cfg.ZitadelIssuer,
		Audience:   cfg.ZitadelAudience,
		RolesClaim: auth.DefaultRolesClaim(),
	})
	if err != nil {
		return err
	}

	appCfg := httpx.ConfigFrom(cfg)
	router := httpx.NewRouter(httpx.App{
		Config: appCfg,
		Logger: logger,
		// Readiness reflects the dependencies this service actually has. It has
		// no database; Core reachability is surfaced per request as a 503 rather
		// than failing readiness, so a Core blip does not restart every admin
		// replica.
		Ready: func(context.Context) error { return nil },
	})

	spec, err := openapi.BuildAdminSpec()
	if err != nil {
		return err
	}
	specBytes, err := openapi.MarshalDocument(spec)
	if err != nil {
		return err
	}
	router.Mount("/", openapi.NewRouter(openapi.RouterConfig{
		Enabled:   cfg.OpenAPIDocsEnabled,
		SpecPath:  "/openapi.json",
		DocsPath:  "/docs",
		SpecBytes: specBytes,
	}))

	router.Mount("/", actorapi.NewRouter(actorapi.Config{
		AppName:      "Admin API",
		Actor:        "admin",
		RequireAuth:  true,
		AllowedRoles: []string{auth.RolePlatformAdmin},
		Register: func(r chi.Router) {
			adminapi.RegisterAdminRoutes(adminapi.Dependencies{Core: core})(r)
		},
	}, core, verifier))

	return httpx.Run(ctx, appCfg, logger, router)
}
