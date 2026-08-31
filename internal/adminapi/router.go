// Package adminapi hosts the Admin Platform HTTP surface.
//
// Extracted verbatim from the monorepo's internal/platformapi package: only the
// admin routes and handlers live here. Shared helpers now come from
// matjero-core's pkg/actorhttp.
package adminapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/matjeroapps/core/packages/httpx"
	"github.com/matjeroapps/core/pkg/actorhttp"
	"github.com/matjeroapps/core/pkg/commerce"
)

type Dependencies struct {
	Commerce commerce.Service
	Repo     commerce.Repository
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

func (deps Dependencies) handleAdminOverview(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var counts map[string]int
	tables := []struct {
		key   string
		query string
	}{
		{"suppliers", "SELECT count(*) FROM suppliers"},
		{"sellers", "SELECT count(*) FROM sellers"},
		{"stores", "SELECT count(*) FROM stores"},
		{"products", "SELECT count(*) FROM products"},
		{"categories", "SELECT count(*) FROM categories"},
		{"offers", "SELECT count(*) FROM supplier_offers"},
		{"listings", "SELECT count(*) FROM seller_listings"},
	}
	counts = make(map[string]int, len(tables))
	for _, table := range tables {
		var count int
		if err := deps.Repo.Pool().QueryRow(ctx, table.query).Scan(&count); err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, "overview_unavailable", "overview unavailable")
			return
		}
		counts[table.key] = count
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"counts": counts})
}

func (deps Dependencies) handleAdminSuppliers(w http.ResponseWriter, r *http.Request) {
	items, err := deps.Repo.ListSuppliers(r.Context(), commerce.Page(actorhttp.ParsePage(r)))
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (deps Dependencies) handleAdminSellers(w http.ResponseWriter, r *http.Request) {
	items, err := deps.Repo.ListSellers(r.Context(), commerce.Page(actorhttp.ParsePage(r)))
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (deps Dependencies) handleAdminStores(w http.ResponseWriter, r *http.Request) {
	items, err := deps.Repo.ListStores(r.Context(), commerce.Page(actorhttp.ParsePage(r)))
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (deps Dependencies) handleAdminProducts(w http.ResponseWriter, r *http.Request) {
	items, err := deps.Repo.ListProducts(r.Context(), commerce.Page(actorhttp.ParsePage(r)))
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (deps Dependencies) handleAdminCategories(w http.ResponseWriter, r *http.Request) {
	items, err := deps.Repo.ListCategories(r.Context(), commerce.Page(actorhttp.ParsePage(r)))
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (deps Dependencies) handleAdminOffers(w http.ResponseWriter, r *http.Request) {
	filter := commerce.SupplierCatalogFilter{
		Page: commerce.Page(actorhttp.ParsePage(r)),
	}
	if market := r.URL.Query().Get("market_code"); market != "" {
		filter.MarketCode = market
	}
	items, err := deps.Repo.ListSupplierCatalog(r.Context(), filter)
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (deps Dependencies) handleAdminListings(w http.ResponseWriter, r *http.Request) {
	page := commerce.Page(actorhttp.ParsePage(r))
	items, err := deps.Repo.ListSellerListings(r.Context(), r.URL.Query().Get("store_id"), page)
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (deps Dependencies) handleAdminLocations(w http.ResponseWriter, r *http.Request) {
	items, err := deps.Repo.ListFulfillmentLocations(r.Context(), r.URL.Query().Get("supplier_id"), commerce.Page(actorhttp.ParsePage(r)))
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (deps Dependencies) handleAdminSupplierStatus(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Status string `json:"status"`
	}
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}
	if err := deps.Repo.UpdateSupplierStatus(r.Context(), chi.URLParam(r, "id"), body.Status); err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": body.Status})
}

func (deps Dependencies) handleAdminSellerStatus(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Status string `json:"status"`
	}
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}
	if err := deps.Repo.UpdateSellerStatus(r.Context(), chi.URLParam(r, "id"), body.Status); err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": body.Status})
}

func (deps Dependencies) handleAdminStoreStatus(w http.ResponseWriter, r *http.Request) {
	actorhttp.UpdateStatusHandler(w, r, deps.Repo.UpdateStoreStatus)
}
func (deps Dependencies) handleAdminProductStatus(w http.ResponseWriter, r *http.Request) {
	actorhttp.UpdateStatusHandler(w, r, deps.Repo.UpdateProductStatus)
}
func (deps Dependencies) handleAdminCategoryStatus(w http.ResponseWriter, r *http.Request) {
	actorhttp.UpdateStatusHandler(w, r, deps.Repo.UpdateCategoryStatus)
}
func (deps Dependencies) handleAdminOfferStatus(w http.ResponseWriter, r *http.Request) {
	actorhttp.UpdateStatusHandler(w, r, deps.Repo.UpdateSupplierOfferStatus)
}
func (deps Dependencies) handleAdminListingStatus(w http.ResponseWriter, r *http.Request) {
	actorhttp.UpdateStatusHandler(w, r, deps.Repo.UpdateSellerListingStatus)
}
func (deps Dependencies) handleAdminLocationStatus(w http.ResponseWriter, r *http.Request) {
	actorhttp.UpdateStatusHandler(w, r, deps.Repo.UpdateFulfillmentLocationStatus)
}
