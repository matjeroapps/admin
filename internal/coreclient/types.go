package coreclient

import (
	"net/url"
	"strconv"
)

// Page is a pagination window.
type Page struct {
	Limit  int
	Offset int
}

// values serializes the window. Absent values are omitted so Core's defaults
// apply rather than being overridden with a zero.
func (p Page) values() url.Values {
	values := url.Values{}
	if p.Limit > 0 {
		values.Set("limit", strconv.Itoa(p.Limit))
	}
	if p.Offset > 0 {
		values.Set("offset", strconv.Itoa(p.Offset))
	}
	return values
}

// StatusUpdate is a status mutation payload.
type StatusUpdate struct {
	Status string `json:"status"`
}

// collectionResponse is the standard list envelope returned by Core.
type collectionResponse[T any] struct {
	Items []T `json:"items"`
}

// statusResponse is the standard response for a status mutation.
type statusResponse struct {
	Status string `json:"status"`
}
