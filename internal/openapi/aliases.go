// Package openapi builds the Admin API OpenAPI document.
//
// The generic document builder, response helpers and shared actor routes live in
// matjero-core's pkg/openapi. This package only declares the admin-specific
// routes. Local aliases keep the route declarations identical to the monorepo
// originals.
package openapi

import (
	core "github.com/matjeroapps/core/pkg/openapi"
)

type (
	RouteSpec     = core.RouteSpec
	ParameterSpec = core.ParameterSpec
	ResponseSpec  = core.ResponseSpec
	DocumentSpec  = core.DocumentSpec
	RouterConfig  = core.RouterConfig
)

var (
	BuildDocument    = core.BuildDocument
	MarshalDocument  = core.MarshalDocument
	ValidateDocument = core.ValidateDocument
	NewSpecHandler   = core.NewSpecHandler
	NewRouter        = core.NewRouter

	actorRoutes          = core.ActorRoutes
	openAPITags          = core.CommonTags
	authReadResponses    = core.AuthReadResponses
	authCreatedResponses = core.AuthCreatedResponses
	authOKResponses      = core.AuthOKResponses
	okResponse           = core.OKResponse
	createdResponse      = core.CreatedResponse
	errorResponse        = core.ErrorResponse
	limitParam           = core.LimitParam
	offsetParam          = core.OffsetParam
	pathStringParam      = core.PathStringParam
	stringParam          = core.StringParam
)

func listResponses[T any](description string) []ResponseSpec {
	return core.ListResponses[T](description)
}
