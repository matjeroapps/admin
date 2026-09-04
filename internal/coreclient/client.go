// Package coreclient is the Admin repository's own HTTP client for the Core
// internal API.
//
// It is the runtime half of the Repository Independence Rule (ADR-017): Admin
// reaches every Core-owned business capability over HTTP and imports no Core Go
// package. All request and response DTOs are owned here, so a Core domain change
// cannot silently become an Admin public contract change.
package coreclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/matjeroapps/admin/internal/httpx"
)

// Header names of the internal service contract. The client sets them on every
// request; inbound copies from a browser are stripped by the caller before these
// are applied.
const (
	// HeaderService names this actor to Core.
	HeaderService = "X-Matjero-Service"
	// HeaderSubject carries the authenticated end-user subject. Core resolves
	// business identity from it itself.
	HeaderSubject = "X-Matjero-Subject"
	// HeaderStorefrontHost carries the trusted, normalized storefront host.
	HeaderStorefrontHost = "X-Matjero-Storefront-Host"
	// HeaderRequestID and HeaderCorrelationID propagate request correlation.
	HeaderRequestID     = "X-Request-Id"
	HeaderCorrelationID = "X-Correlation-Id"
)

// maxResponseBytes bounds every Core response. A misbehaving or compromised Core
// must not be able to exhaust Seller's memory.
const maxResponseBytes = 8 << 20 // 8 MiB

// defaultTimeout bounds a single Core call. There is no retry: a retry policy
// belongs to the caller that knows whether an operation is idempotent, and an
// automatic retry on a non-idempotent write would duplicate it.
const defaultTimeout = 10 * time.Second

// Config configures the client.
type Config struct {
	// BaseURL is the Core internal API root, e.g. "http://core-api:8080".
	BaseURL string
	// Token is this actor's service credential. It is a secret and is never
	// logged.
	Token string
	// Service is the caller name presented to Core, e.g. "seller".
	Service string
	// Timeout bounds a single request. Defaults to 10s when unset.
	Timeout time.Duration
}

// Client calls the Core internal API.
type Client struct {
	baseURL *url.URL
	token   string
	service string
	http    *http.Client
}

// New builds a client. It fails when the base URL is unusable or the service
// credential is missing, so a misconfigured deployment fails at startup rather
// than on the first customer request.
func New(cfg Config) (*Client, error) {
	if strings.TrimSpace(cfg.BaseURL) == "" {
		return nil, fmt.Errorf("coreclient: base URL is required")
	}
	parsed, err := url.Parse(cfg.BaseURL)
	if err != nil {
		return nil, fmt.Errorf("coreclient: parse base URL: %w", err)
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return nil, fmt.Errorf("coreclient: base URL scheme must be http or https, got %q", parsed.Scheme)
	}
	if parsed.Host == "" {
		return nil, fmt.Errorf("coreclient: base URL must include a host")
	}
	if strings.TrimSpace(cfg.Token) == "" {
		return nil, fmt.Errorf("coreclient: service token is required")
	}
	if strings.TrimSpace(cfg.Service) == "" {
		return nil, fmt.Errorf("coreclient: service name is required")
	}

	timeout := cfg.Timeout
	if timeout <= 0 {
		timeout = defaultTimeout
	}

	return &Client{
		baseURL: parsed,
		token:   cfg.Token,
		service: cfg.Service,
		http:    &http.Client{Timeout: timeout},
	}, nil
}

// requestOptions carries the per-call context that is not part of the URL or
// body.
type requestOptions struct {
	// Subject is the authenticated end-user subject forwarded to Core.
	Subject string
	// StorefrontHost is the trusted storefront host for tenant resolution.
	StorefrontHost string
	// Locale overrides locale negotiation when set.
	Locale string
}

// get performs a GET against a Core path and decodes the response into dst.
func (c *Client) get(ctx context.Context, path string, query url.Values, opts requestOptions, dst any) error {
	return c.do(ctx, http.MethodGet, path, query, nil, opts, dst)
}

// post performs a POST with a JSON body and decodes the response into dst.
func (c *Client) post(ctx context.Context, path string, body any, opts requestOptions, dst any) error {
	return c.do(ctx, http.MethodPost, path, nil, body, opts, dst)
}

// put performs a PUT with a JSON body and decodes the response into dst.
func (c *Client) put(ctx context.Context, path string, body any, opts requestOptions, dst any) error {
	return c.do(ctx, http.MethodPut, path, nil, body, opts, dst)
}

func (c *Client) do(ctx context.Context, method, path string, query url.Values, body any, opts requestOptions, dst any) error {
	endpoint, err := c.url(path, query)
	if err != nil {
		return err
	}

	var reader io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("coreclient: encode request body: %w", err)
		}
		reader = bytes.NewReader(encoded)
	}

	req, err := http.NewRequestWithContext(ctx, method, endpoint, reader)
	if err != nil {
		return fmt.Errorf("coreclient: build request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	// Service authentication. The token is bound to the caller name, so both
	// must be sent together.
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set(HeaderService, c.service)

	if opts.Subject != "" {
		req.Header.Set(HeaderSubject, opts.Subject)
	}
	if opts.StorefrontHost != "" {
		req.Header.Set(HeaderStorefrontHost, opts.StorefrontHost)
	}
	if opts.Locale != "" {
		// query is nil when the caller passed no values; Set on a nil map panics.
		if query == nil {
			query = url.Values{}
		}
		query.Set("locale", opts.Locale)
		req.URL.RawQuery = query.Encode()
	}
	c.propagateCorrelation(ctx, req)

	resp, err := c.http.Do(req)
	if err != nil {
		// Connection refused, DNS failure, timeout: Core is unreachable. The
		// underlying error is wrapped for logging but is never surfaced to a
		// customer, because it can contain the internal Core hostname.
		if ctxErr := ctx.Err(); ctxErr != nil {
			return fmt.Errorf("coreclient: %w: %w", ErrUnavailable, ctxErr)
		}
		return fmt.Errorf("coreclient: %w: %w", ErrUnavailable, err)
	}
	defer func() { _ = resp.Body.Close() }()

	// Bounded read with sentinel byte: a hostile or broken Core cannot exhaust memory or silently truncate.
	payload, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes+1))
	if err != nil {
		return fmt.Errorf("coreclient: %w: read response: %w", ErrUnavailable, err)
	}
	if len(payload) > maxResponseBytes {
		return fmt.Errorf("coreclient: %w: response body exceeds limit of %d bytes", ErrUnavailable, maxResponseBytes)
	}

	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return decodeError(resp.StatusCode, payload)
	}

	// Core always answers with JSON; anything else means we are talking to the
	// wrong service or through a proxy that rewrote the response. This is
	// checked even when the caller does not decode the body, so a misrouted
	// deployment fails loudly instead of silently succeeding.
	if ct := resp.Header.Get("Content-Type"); ct != "" && !strings.Contains(ct, "application/json") {
		return fmt.Errorf("coreclient: %w: unexpected content type %q", ErrUnavailable, ct)
	}
	if dst == nil {
		return nil
	}

	if err := json.Unmarshal(payload, dst); err != nil {
		return fmt.Errorf("coreclient: %w: decode response: %w", ErrUnavailable, err)
	}
	return nil
}

// decodeError turns a non-2xx Core response into a typed *Error. An
// unrecognizable body still yields a typed error, so callers never have to
// handle a bare status code.
func decodeError(status int, payload []byte) error {
	var envelope errorResponse
	if err := json.Unmarshal(payload, &envelope); err != nil || envelope.Error.Code == "" {
		return &Error{Status: status, Code: CodeInternalError, Message: strings.TrimSpace(string(payload))}
	}
	code := envelope.Error.Code
	return &Error{Status: status, Code: code, Message: envelope.Error.Message}
}

// propagateCorrelation forwards the Seller request's correlation identifiers so
// a Core log line can be tied back to the originating customer request.
func (c *Client) propagateCorrelation(ctx context.Context, req *http.Request) {
	if id := httpx.RequestID(ctx); id != "" {
		req.Header.Set(HeaderRequestID, id)
	}
	if id := httpx.CorrelationID(ctx); id != "" {
		req.Header.Set(HeaderCorrelationID, id)
	}
}

func (c *Client) url(path string, query url.Values) (string, error) {
	ref, err := url.Parse(path)
	if err != nil {
		return "", fmt.Errorf("coreclient: parse path %q: %w", path, err)
	}
	endpoint := c.baseURL.ResolveReference(ref)
	if query != nil {
		endpoint.RawQuery = query.Encode()
	}
	return endpoint.String(), nil
}
