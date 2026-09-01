// Package markets holds the market reference-data shapes the Admin API serves.
//
// Market reference data is Core-owned business data: it is read through the Core
// internal API, never from a local database. Only the wire shapes live here, so
// the Admin OpenAPI document and bootstrap payload stay stable without importing
// Core.
package markets

import (
	"github.com/matjeroapps/admin/internal/i18n"
)

// Country is a market's country reference data.
type Country struct {
	Code     string `json:"code"`
	Name     string `json:"name"`
	Timezone string `json:"timezone"`
	Status   string `json:"status"`
}

// Currency is a market's currency reference data.
type Currency struct {
	Code      string `json:"code"`
	Symbol    string `json:"symbol"`
	MinorUnit int    `json:"minor_unit"`
	Status    string `json:"status"`
}

// Market is the public market shape served by /v1/markets and embedded in the
// bootstrap payload.
type Market struct {
	Code             string         `json:"code"`
	Country          Country        `json:"country"`
	Currency         Currency       `json:"currency"`
	DefaultLocale    i18n.Locale    `json:"default_locale"`
	SupportedLocales []i18n.Locale  `json:"supported_locales"`
	Timezone         string         `json:"timezone"`
	Status           string         `json:"status"`
	Configuration    map[string]any `json:"configuration"`
}
