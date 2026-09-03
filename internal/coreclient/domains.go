package coreclient

import (
	"context"
	"net/url"
	"time"
)

// StoreDomain represents a storefront domain in Admin coreclient.
type StoreDomain struct {
	ID            string     `json:"id"`
	StoreID       string     `json:"store_id"`
	Domain        string     `json:"domain"`
	IsPrimary     bool       `json:"is_primary"`
	VerifiedAt    *time.Time `json:"verified_at,omitempty"`
	Status        string     `json:"status"`
	DomainType    string     `json:"domain_type,omitempty"`
	LastCheckedAt *time.Time `json:"last_checked_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// DomainFilter carries query filters for ListDomains.
type DomainFilter struct {
	StoreID    string
	SellerID   string
	Status     string
	DomainType string
	Search     string
	Page       Page
}

func (f DomainFilter) values() url.Values {
	query := f.Page.values()
	if f.StoreID != "" {
		query.Set("store_id", f.StoreID)
	}
	if f.SellerID != "" {
		query.Set("seller_id", f.SellerID)
	}
	if f.Status != "" {
		query.Set("status", f.Status)
	}
	if f.DomainType != "" {
		query.Set("domain_type", f.DomainType)
	}
	if f.Search != "" {
		query.Set("search", f.Search)
	}
	return query
}

// ListDomains lists domains across stores with optional filters.
func (c *Client) ListDomains(ctx context.Context, filter DomainFilter) ([]StoreDomain, error) {
	var payload collectionResponse[StoreDomain]
	err := c.get(ctx, "/internal/v1/domains", filter.values(), requestOptions{}, &payload)
	return payload.Items, err
}

// DisableDomain disables a storefront domain.
func (c *Client) DisableDomain(ctx context.Context, domainID string) (StoreDomain, error) {
	var payload StoreDomain
	path := "/internal/v1/domains/" + url.PathEscape(domainID) + "/disable"
	err := c.post(ctx, path, nil, requestOptions{}, &payload)
	return payload, err
}

// EnableDomain re-enables a disabled storefront domain.
func (c *Client) EnableDomain(ctx context.Context, domainID string) (StoreDomain, error) {
	var payload StoreDomain
	path := "/internal/v1/domains/" + url.PathEscape(domainID) + "/enable"
	err := c.post(ctx, path, nil, requestOptions{}, &payload)
	return payload, err
}
