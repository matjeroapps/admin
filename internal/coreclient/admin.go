package coreclient

import (
	"context"
	"net/url"
	"time"

	"github.com/matjeroapps/admin/internal/money"
)

// Platform administration DTOs.
//
// These are Admin-owned wire shapes for Core-owned business data. The field sets
// and JSON shapes match the public contract the Admin API has always published;
// changing one is a public contract change, not a client detail.

// Supplier is a supplier profile.
type Supplier struct {
	ID        string    `json:"id"`
	Code      string    `json:"code"`
	Name      string    `json:"name"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Seller is a seller profile.
type Seller struct {
	ID        string    `json:"id"`
	Code      string    `json:"code"`
	Name      string    `json:"name"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Store is a seller store.
type Store struct {
	ID         string    `json:"id"`
	SellerID   string    `json:"seller_id"`
	MarketCode string    `json:"market_code"`
	Code       string    `json:"code"`
	Name       string    `json:"name"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// Product is a global catalog product.
type Product struct {
	ID        string    `json:"id"`
	Slug      string    `json:"slug"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Category is a global catalog category.
type Category struct {
	ID               string    `json:"id"`
	ParentCategoryID *string   `json:"parent_category_id,omitempty"`
	Slug             string    `json:"slug"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// FulfillmentLocation is a supplier's stocking location.
type FulfillmentLocation struct {
	SupplierID       string    `json:"supplier_id"`
	ID               string    `json:"id"`
	SupplierMarketID string    `json:"supplier_market_id"`
	MarketCode       string    `json:"market_code"`
	Code             string    `json:"code"`
	Name             string    `json:"name"`
	LocationType     string    `json:"location_type"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// SellerListing is a seller's listing of a supplier offer.
type SellerListing struct {
	ID              string    `json:"id"`
	StoreID         string    `json:"store_id"`
	ProductID       string    `json:"product_id"`
	SupplierOfferID *string   `json:"supplier_offer_id,omitempty"`
	MarketCode      string    `json:"market_code"`
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// SupplierCatalogItem is a supplier offer as listed by the admin offer routes.
type SupplierCatalogItem struct {
	OfferID          string       `json:"offer_id"`
	OfferStatus      string       `json:"offer_status"`
	MarketCode       string       `json:"market_code"`
	ProductID        string       `json:"product_id"`
	ProductSlug      string       `json:"product_slug"`
	ProductName      string       `json:"product_name"`
	ProductStatus    string       `json:"product_status"`
	SupplierID       string       `json:"supplier_id"`
	SupplierCode     string       `json:"supplier_code"`
	SupplierName     string       `json:"supplier_name"`
	CategoryID       string       `json:"category_id,omitempty"`
	CategoryName     string       `json:"category_name,omitempty"`
	Price            *money.Money `json:"price,omitempty"`
	IsAvailable      *bool        `json:"is_available,omitempty"`
	AvailableQty     *int64       `json:"available_qty,omitempty"`
	FulfillmentCount int64        `json:"fulfillment_count,omitempty"`
	UpdatedAt        time.Time    `json:"updated_at"`
}

// OverviewCounts carries the platform aggregate counts.
type OverviewCounts struct {
	Counts map[string]int `json:"counts"`
}

// --- Platform administration capabilities ---
//
// Every call below is admin-scoped on the Core side: Core rejects them for any
// other caller, so Admin cannot be used to widen another actor's reach.

// GetOverview returns the platform aggregate counts. The counting SQL lives in
// Core next to the schema it counts, so Admin needs no database access.
func (c *Client) GetOverview(ctx context.Context) (map[string]int, error) {
	var payload OverviewCounts
	err := c.get(ctx, "/internal/v1/admin/overview", nil, requestOptions{}, &payload)
	return payload.Counts, err
}

// ListSuppliers lists suppliers across the platform.
func (c *Client) ListSuppliers(ctx context.Context, page Page) ([]Supplier, error) {
	var payload collectionResponse[Supplier]
	err := c.get(ctx, "/internal/v1/suppliers", page.values(), requestOptions{}, &payload)
	return payload.Items, err
}

// UpdateSupplierStatus moderates a supplier.
func (c *Client) UpdateSupplierStatus(ctx context.Context, supplierID, status string) error {
	path := "/internal/v1/suppliers/" + url.PathEscape(supplierID) + "/status"
	return c.post(ctx, path, StatusUpdate{Status: status}, requestOptions{}, &statusResponse{})
}

// ListSellers lists sellers across the platform.
func (c *Client) ListSellers(ctx context.Context, page Page) ([]Seller, error) {
	var payload collectionResponse[Seller]
	err := c.get(ctx, "/internal/v1/sellers", page.values(), requestOptions{}, &payload)
	return payload.Items, err
}

// UpdateSellerStatus moderates a seller.
func (c *Client) UpdateSellerStatus(ctx context.Context, sellerID, status string) error {
	path := "/internal/v1/sellers/" + url.PathEscape(sellerID) + "/status"
	return c.post(ctx, path, StatusUpdate{Status: status}, requestOptions{}, &statusResponse{})
}

// ListStores lists stores across the platform.
func (c *Client) ListStores(ctx context.Context, page Page) ([]Store, error) {
	var payload collectionResponse[Store]
	err := c.get(ctx, "/internal/v1/stores", page.values(), requestOptions{}, &payload)
	return payload.Items, err
}

// UpdateStoreStatus moderates a store.
func (c *Client) UpdateStoreStatus(ctx context.Context, storeID, status string) error {
	path := "/internal/v1/stores/" + url.PathEscape(storeID) + "/status"
	return c.post(ctx, path, StatusUpdate{Status: status}, requestOptions{}, &statusResponse{})
}

// ListProducts lists catalog products.
func (c *Client) ListProducts(ctx context.Context, page Page) ([]Product, error) {
	var payload collectionResponse[Product]
	err := c.get(ctx, "/internal/v1/products", page.values(), requestOptions{}, &payload)
	return payload.Items, err
}

// UpdateProductStatus moderates a product.
func (c *Client) UpdateProductStatus(ctx context.Context, productID, status string) error {
	path := "/internal/v1/products/" + url.PathEscape(productID) + "/status"
	return c.post(ctx, path, StatusUpdate{Status: status}, requestOptions{}, &statusResponse{})
}

// ListCategories lists catalog categories.
func (c *Client) ListCategories(ctx context.Context, page Page) ([]Category, error) {
	var payload collectionResponse[Category]
	err := c.get(ctx, "/internal/v1/categories", page.values(), requestOptions{}, &payload)
	return payload.Items, err
}

// UpdateCategoryStatus moderates a category.
func (c *Client) UpdateCategoryStatus(ctx context.Context, categoryID, status string) error {
	path := "/internal/v1/categories/" + url.PathEscape(categoryID) + "/status"
	return c.post(ctx, path, StatusUpdate{Status: status}, requestOptions{}, &statusResponse{})
}

// ListOffers lists supplier offers, optionally filtered by market.
func (c *Client) ListOffers(ctx context.Context, marketCode string, page Page) ([]SupplierCatalogItem, error) {
	var payload collectionResponse[SupplierCatalogItem]
	query := page.values()
	if marketCode != "" {
		query.Set("market_code", marketCode)
	}
	err := c.get(ctx, "/internal/v1/offers", query, requestOptions{}, &payload)
	return payload.Items, err
}

// UpdateOfferStatus moderates a supplier offer.
func (c *Client) UpdateOfferStatus(ctx context.Context, offerID, status string) error {
	path := "/internal/v1/offers/" + url.PathEscape(offerID) + "/status"
	return c.post(ctx, path, StatusUpdate{Status: status}, requestOptions{}, &statusResponse{})
}

// ListListings lists seller listings, optionally filtered by store.
func (c *Client) ListListings(ctx context.Context, storeID string, page Page) ([]SellerListing, error) {
	var payload collectionResponse[SellerListing]
	query := page.values()
	if storeID != "" {
		query.Set("store_id", storeID)
	}
	err := c.get(ctx, "/internal/v1/listings", query, requestOptions{}, &payload)
	return payload.Items, err
}

// UpdateListingStatus moderates a seller listing.
func (c *Client) UpdateListingStatus(ctx context.Context, listingID, status string) error {
	path := "/internal/v1/listings/" + url.PathEscape(listingID) + "/status"
	return c.post(ctx, path, StatusUpdate{Status: status}, requestOptions{}, &statusResponse{})
}

// ListLocations lists fulfillment locations, optionally filtered by supplier.
func (c *Client) ListLocations(ctx context.Context, supplierID string, page Page) ([]FulfillmentLocation, error) {
	var payload collectionResponse[FulfillmentLocation]
	query := page.values()
	if supplierID != "" {
		query.Set("supplier_id", supplierID)
	}
	err := c.get(ctx, "/internal/v1/locations", query, requestOptions{}, &payload)
	return payload.Items, err
}

// UpdateLocationStatus moderates a fulfillment location.
func (c *Client) UpdateLocationStatus(ctx context.Context, locationID, status string) error {
	path := "/internal/v1/locations/" + url.PathEscape(locationID) + "/status"
	return c.post(ctx, path, StatusUpdate{Status: status}, requestOptions{}, &statusResponse{})
}
