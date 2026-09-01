package coreclient

import (
	"context"
	"net/url"

	"github.com/matjeroapps/admin/internal/i18n"
	"github.com/matjeroapps/admin/internal/markets"
)

// MarketsResponse is the Core market collection envelope.
type MarketsResponse struct {
	Markets []markets.Market `json:"markets"`
}

// ListMarkets returns the market reference data every actor bootstrap needs.
func (c *Client) ListMarkets(ctx context.Context, locale i18n.Locale) ([]markets.Market, error) {
	var payload MarketsResponse
	query := url.Values{}
	if locale != "" {
		query.Set("locale", string(locale))
	}
	if err := c.get(ctx, "/internal/v1/markets", query, requestOptions{Locale: string(locale)}, &payload); err != nil {
		return nil, err
	}
	return payload.Markets, nil
}

// GetMarket resolves a single market by code.
func (c *Client) GetMarket(ctx context.Context, code string, locale i18n.Locale) (markets.Market, error) {
	var payload markets.Market
	path := "/internal/v1/markets/" + url.PathEscape(code)
	if err := c.get(ctx, path, nil, requestOptions{Locale: string(locale)}, &payload); err != nil {
		return markets.Market{}, err
	}
	return payload, nil
}
