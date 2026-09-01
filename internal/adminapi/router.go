// Package adminapi hosts the Admin Platform HTTP surface.
//
// Every business capability is a Core-owned runtime call (ADR-017). This package
// owns request parsing, authorization of the authenticated principal, and the
// public response contract; it owns no business rules and no database access.
package adminapi

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/matjeroapps/admin/internal/actorhttp"
	"github.com/matjeroapps/admin/internal/coreclient"
	"github.com/matjeroapps/admin/internal/httpx"
)

// CoreCapabilities are the Core calls the admin routes depend on. The interface
// exists so handlers can be tested against a stub Core server.
//
// Every one of these is admin-scoped on the Core side: Core rejects them for any
// other caller, so the Admin API cannot be used to widen another actor's reach.
type CoreCapabilities interface {
	GetOverview(ctx context.Context) (map[string]int, error)
	ListSuppliers(ctx context.Context, page coreclient.Page) ([]coreclient.Supplier, error)
	UpdateSupplierStatus(ctx context.Context, supplierID, status string) error
	ListSellers(ctx context.Context, page coreclient.Page) ([]coreclient.Seller, error)
	UpdateSellerStatus(ctx context.Context, sellerID, status string) error
	ListStores(ctx context.Context, page coreclient.Page) ([]coreclient.Store, error)
	UpdateStoreStatus(ctx context.Context, storeID, status string) error
	ListProducts(ctx context.Context, page coreclient.Page) ([]coreclient.Product, error)
	UpdateProductStatus(ctx context.Context, productID, status string) error
	ListCategories(ctx context.Context, page coreclient.Page) ([]coreclient.Category, error)
	UpdateCategoryStatus(ctx context.Context, categoryID, status string) error
	ListOffers(ctx context.Context, marketCode string, page coreclient.Page) ([]coreclient.SupplierCatalogItem, error)
	UpdateOfferStatus(ctx context.Context, offerID, status string) error
	ListListings(ctx context.Context, storeID string, page coreclient.Page) ([]coreclient.SellerListing, error)
	UpdateListingStatus(ctx context.Context, listingID, status string) error
	ListLocations(ctx context.Context, supplierID string, page coreclient.Page) ([]coreclient.FulfillmentLocation, error)
	UpdateLocationStatus(ctx context.Context, locationID, status string) error
}

// Dependencies wires the admin routes.
type Dependencies struct {
	Core CoreCapabilities
}

func RegisterAdminRoutes(deps Dependencies) func(r chi.Router) {
	return func(r chi.Router) {
		r.Get("/admin/overview", deps.handleAdminOverview)
		r.Get("/admin/suppliers", deps.handleAdminSuppliers)
		r.Post("/admin/suppliers/{id}/status", deps.handleAdminSupplierStatus)
		r.Get("/admin/sellers", deps.handleAdminSellers)
		r.Post("/admin/sellers/{id}/status", deps.handleAdminSellerStatus)
		r.Get("/admin/stores", deps.handleAdminStores)
		r.Post("/admin/stores/{id}/status", deps.handleAdminStoreStatus)
		r.Get("/admin/products", deps.handleAdminProducts)
		r.Post("/admin/products/{id}/status", deps.handleAdminProductStatus)
		r.Get("/admin/categories", deps.handleAdminCategories)
		r.Post("/admin/categories/{id}/status", deps.handleAdminCategoryStatus)
		r.Get("/admin/offers", deps.handleAdminOffers)
		r.Post("/admin/offers/{id}/status", deps.handleAdminOfferStatus)
		r.Get("/admin/listings", deps.handleAdminListings)
		r.Post("/admin/listings/{id}/status", deps.handleAdminListingStatus)
		r.Get("/admin/locations", deps.handleAdminLocations)
		r.Post("/admin/locations/{id}/status", deps.handleAdminLocationStatus)
	}
}

// pageFrom converts the shared pagination window into the Core client's shape.
func pageFrom(r *http.Request) coreclient.Page {
	page := actorhttp.ParsePage(r)
	return coreclient.Page{Limit: page.Limit, Offset: page.Offset}
}

// updateStatus reads a status mutation body and applies it through fn.
func (deps Dependencies) updateStatus(w http.ResponseWriter, r *http.Request, id string, fn func(context.Context, string, string) error) {
	var body struct {
		Status string `json:"status"`
	}
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}
	if err := fn(r.Context(), id, body.Status); err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": body.Status})
}

func (deps Dependencies) handleAdminOverview(w http.ResponseWriter, r *http.Request) {
	counts, err := deps.Core.GetOverview(r.Context())
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"counts": counts})
}

func (deps Dependencies) handleAdminSuppliers(w http.ResponseWriter, r *http.Request) {
	items, err := deps.Core.ListSuppliers(r.Context(), pageFrom(r))
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (deps Dependencies) handleAdminSupplierStatus(w http.ResponseWriter, r *http.Request) {
	deps.updateStatus(w, r, chi.URLParam(r, "id"), deps.Core.UpdateSupplierStatus)
}

func (deps Dependencies) handleAdminSellers(w http.ResponseWriter, r *http.Request) {
	items, err := deps.Core.ListSellers(r.Context(), pageFrom(r))
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (deps Dependencies) handleAdminSellerStatus(w http.ResponseWriter, r *http.Request) {
	deps.updateStatus(w, r, chi.URLParam(r, "id"), deps.Core.UpdateSellerStatus)
}

func (deps Dependencies) handleAdminStores(w http.ResponseWriter, r *http.Request) {
	items, err := deps.Core.ListStores(r.Context(), pageFrom(r))
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (deps Dependencies) handleAdminStoreStatus(w http.ResponseWriter, r *http.Request) {
	deps.updateStatus(w, r, chi.URLParam(r, "id"), deps.Core.UpdateStoreStatus)
}

func (deps Dependencies) handleAdminProducts(w http.ResponseWriter, r *http.Request) {
	items, err := deps.Core.ListProducts(r.Context(), pageFrom(r))
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (deps Dependencies) handleAdminProductStatus(w http.ResponseWriter, r *http.Request) {
	deps.updateStatus(w, r, chi.URLParam(r, "id"), deps.Core.UpdateProductStatus)
}

func (deps Dependencies) handleAdminCategories(w http.ResponseWriter, r *http.Request) {
	items, err := deps.Core.ListCategories(r.Context(), pageFrom(r))
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (deps Dependencies) handleAdminCategoryStatus(w http.ResponseWriter, r *http.Request) {
	deps.updateStatus(w, r, chi.URLParam(r, "id"), deps.Core.UpdateCategoryStatus)
}

func (deps Dependencies) handleAdminOffers(w http.ResponseWriter, r *http.Request) {
	items, err := deps.Core.ListOffers(r.Context(), r.URL.Query().Get("market_code"), pageFrom(r))
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (deps Dependencies) handleAdminOfferStatus(w http.ResponseWriter, r *http.Request) {
	deps.updateStatus(w, r, chi.URLParam(r, "id"), deps.Core.UpdateOfferStatus)
}

func (deps Dependencies) handleAdminListings(w http.ResponseWriter, r *http.Request) {
	items, err := deps.Core.ListListings(r.Context(), r.URL.Query().Get("store_id"), pageFrom(r))
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (deps Dependencies) handleAdminListingStatus(w http.ResponseWriter, r *http.Request) {
	deps.updateStatus(w, r, chi.URLParam(r, "id"), deps.Core.UpdateListingStatus)
}

func (deps Dependencies) handleAdminLocations(w http.ResponseWriter, r *http.Request) {
	items, err := deps.Core.ListLocations(r.Context(), r.URL.Query().Get("supplier_id"), pageFrom(r))
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (deps Dependencies) handleAdminLocationStatus(w http.ResponseWriter, r *http.Request) {
	deps.updateStatus(w, r, chi.URLParam(r, "id"), deps.Core.UpdateLocationStatus)
}
