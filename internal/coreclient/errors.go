package coreclient

import (
	"errors"
	"fmt"
	"net/http"
)

// Error codes of the Core internal API contract (/internal/v1).
//
// This vocabulary is closed and owned by Core. It is reproduced here because the
// Seller repository must not import Core to learn it. Adding a code on the Core
// side is a contract change; unknown codes collapse to internal_error so a new
// Core release can never make the Seller API leak an unmapped failure.
const (
	CodeNotFound              = "not_found"
	CodeInvalidArgument       = "invalid_argument"
	CodeValidationError       = "validation_error"
	CodeUnauthorized          = "unauthorized"
	CodeForbidden             = "forbidden"
	CodeConflict              = "conflict"
	CodeMarketMismatch        = "market_mismatch"
	CodeInsufficientInventory = "insufficient_inventory"
	CodeSchemaMismatch        = "schema_mismatch"
	CodeUnsafeContent         = "unsafe_content"
	CodePreviewUnavailable    = "preview_unavailable"
	CodeStorefrontUnavailable = "storefront_unavailable"
	CodeUnavailable           = "unavailable"
	CodeInternalError         = "internal_error"
)

// ErrUnavailable is returned when Core cannot be reached at all: connection
// refused, DNS failure, timeout, or a malformed response. It is distinct from a
// Core error response so callers can map transport failure to 503 without
// mistaking it for a business outcome.
var ErrUnavailable = errors.New("core service unavailable")

// Error is a failure reported by the Core internal API.
type Error struct {
	// Status is the HTTP status Core responded with.
	Status int
	// Code is the internal error code, or "" when the response had no
	// recognizable error envelope.
	Code string
	// Message is Core's human-readable message. It is safe to log but is never
	// forwarded to a customer: the Seller API maps codes onto its own public
	// messages.
	Message string
}

func (e *Error) Error() string {
	if e.Code == "" {
		return fmt.Sprintf("core api: unexpected status %d", e.Status)
	}
	return fmt.Sprintf("core api: %s (status %d)", e.Code, e.Status)
}

// Is lets callers test for the sentinel transport failure.
func (e *Error) Is(target error) bool {
	return target == ErrUnavailable && e != nil && e.Code == ""
}

// errorResponse is the wire shape of the Core error envelope. It matches the
// platform error contract so one decoder handles both actor and Core errors.
type errorResponse struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

// statusForCode maps a Core error code onto the HTTP status the Seller API
// should surface. Core already sends the right status; this is a defensive
// fallback for the case where a proxy or an older Core release disagrees.
func statusForCode(code string) int {
	switch code {
	case CodeNotFound, CodeStorefrontUnavailable:
		return http.StatusNotFound
	case CodeInvalidArgument, CodeValidationError, CodeSchemaMismatch, CodeUnsafeContent:
		return http.StatusBadRequest
	case CodeUnauthorized:
		return http.StatusUnauthorized
	case CodeForbidden:
		return http.StatusForbidden
	case CodeConflict, CodeMarketMismatch, CodeInsufficientInventory:
		return http.StatusConflict
	case CodeUnavailable, CodePreviewUnavailable:
		return http.StatusServiceUnavailable
	default:
		return http.StatusInternalServerError
	}
}
