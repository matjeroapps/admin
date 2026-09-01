// Package actorhttp exposes the HTTP helpers shared by the Admin API's route
// packages.
//
// These helpers were localized from Core during the Repository Independence
// refactor (ADR-017). They are duplicated rather than shared because a
// cross-repository Go import is exactly what the rule forbids. The duplication is
// small and mechanical, and it buys this repository the ability to build, test
// and deploy on its own.
package actorhttp

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/matjeroapps/admin/internal/auth"
	"github.com/matjeroapps/admin/internal/coreclient"
	"github.com/matjeroapps/admin/internal/httpx"
)

// Page carries the normalised pagination window parsed from a request.
type Page struct {
	Limit  int
	Offset int
}

// ParsePage reads limit/offset query parameters, defaulting the limit to 25
// when it is missing, non-positive or above 100, and clamping a negative
// offset to zero.
func ParsePage(r *http.Request) Page {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if limit <= 0 || limit > 100 {
		limit = 25
	}
	if offset < 0 {
		offset = 0
	}
	return Page{Limit: limit, Offset: offset}
}

// SubjectFrom returns the authenticated principal subject carried on the
// request context.
func SubjectFrom(r *http.Request) (string, error) {
	principal, ok := auth.PrincipalFrom(r.Context())
	if !ok {
		return "", errors.New("missing principal")
	}
	if principal.Subject == "" {
		return "", errors.New("missing principal subject")
	}
	return principal.Subject, nil
}

// DecodeJSON decodes the request body into dst. It writes a 400 response and
// reports false when the body is not valid JSON.
func DecodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "invalid request body")
		return false
	}
	return true
}

// TranslationInput is the localized name/description payload shared by the
// actor write endpoints.
type TranslationInput struct {
	Locale      string `json:"locale"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

// UpdateStatusHandler implements the shared "POST .../{id}/status" contract.
func UpdateStatusHandler(w http.ResponseWriter, r *http.Request, fn func(context.Context, string, string) error) {
	var body struct {
		Status string `json:"status"`
	}
	if !DecodeJSON(w, r, &body) {
		return
	}
	if err := fn(r.Context(), chi.URLParam(r, "id"), body.Status); err != nil {
		WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": body.Status})
}

// WriteCoreError maps a Core client failure onto the Admin public error
// contract.
//
// The mapping preserves the status and code the Admin API has always returned
// for each business outcome, so replacing a Go call with an HTTP call does not
// change the public contract. Transport failures collapse to 503 with a generic
// message: an operator never sees a connection error, an internal Core hostname,
// or a stack trace.
func WriteCoreError(w http.ResponseWriter, err error) {
	if err == nil {
		return
	}

	var coreErr *coreclient.Error
	if errors.As(err, &coreErr) {
		writeMappedCoreError(w, coreErr)
		return
	}

	// Core could not be reached, or answered with something unusable.
	if errors.Is(err, coreclient.ErrUnavailable) || errors.Is(err, context.DeadlineExceeded) {
		httpx.WriteError(w, http.StatusServiceUnavailable, "service_unavailable", "service temporarily unavailable")
		return
	}
	httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "internal server error")
}

// writeMappedCoreError translates a Core error code into the public response the
// Admin API has always produced for that outcome.
func writeMappedCoreError(w http.ResponseWriter, coreErr *coreclient.Error) {
	switch coreErr.Code {
	case coreclient.CodeNotFound:
		httpx.WriteError(w, http.StatusNotFound, "not_found", "resource not found")
	case coreclient.CodeValidationError, coreclient.CodeInvalidArgument:
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", "invalid input")
	case coreclient.CodeMarketMismatch:
		httpx.WriteError(w, http.StatusConflict, "market_mismatch", "market mismatch")
	case coreclient.CodeInsufficientInventory:
		httpx.WriteError(w, http.StatusConflict, "insufficient_inventory", "insufficient inventory")
	case coreclient.CodeConflict:
		httpx.WriteError(w, http.StatusConflict, "conflict", "conflict")
	case coreclient.CodeUnauthorized:
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "unauthorized")
	case coreclient.CodeForbidden:
		httpx.WriteError(w, http.StatusForbidden, "forbidden", "forbidden")
	case coreclient.CodeUnavailable:
		httpx.WriteError(w, http.StatusServiceUnavailable, "service_unavailable", "service temporarily unavailable")
	default:
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "internal server error")
	}
}
