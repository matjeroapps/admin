package openapi

import (
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
)

func TestBuildDocumentsValidate(t *testing.T) {
	specs := []struct {
		name  string
		build func() (*openapi3.T, error)
	}{
		{name: "admin", build: BuildAdminSpec},
	}

	for _, tc := range specs {
		t.Run(tc.name, func(t *testing.T) {
			spec, err := tc.build()
			if err != nil {
				t.Fatalf("build spec: %v", err)
			}
			if err := ValidateDocument(spec); err != nil {
				t.Fatalf("validate spec: %v", err)
			}
		})
	}
}

func TestBuildDocumentsDeterministic(t *testing.T) {
	specs := []struct {
		name  string
		build func() (*openapi3.T, error)
	}{
		{name: "admin", build: BuildAdminSpec},
	}

	for _, tc := range specs {
		t.Run(tc.name, func(t *testing.T) {
			first, err := tc.build()
			if err != nil {
				t.Fatalf("build first spec: %v", err)
			}
			firstBytes, err := MarshalDocument(first)
			if err != nil {
				t.Fatalf("marshal first spec: %v", err)
			}

			second, err := tc.build()
			if err != nil {
				t.Fatalf("build second spec: %v", err)
			}
			secondBytes, err := MarshalDocument(second)
			if err != nil {
				t.Fatalf("marshal second spec: %v", err)
			}

			if string(firstBytes) != string(secondBytes) {
				t.Fatalf("spec generation is not deterministic")
			}
		})
	}
}

func TestSecuritySchemes(t *testing.T) {
	authSpecs := []struct {
		name  string
		build func() (*openapi3.T, error)
	}{
		{name: "admin", build: BuildAdminSpec},
	}

	for _, tc := range authSpecs {
		t.Run(tc.name, func(t *testing.T) {
			spec, err := tc.build()
			if err != nil {
				t.Fatalf("build spec: %v", err)
			}
			if spec.Components == nil || spec.Components.SecuritySchemes == nil {
				t.Fatalf("missing security schemes")
			}
			if _, ok := spec.Components.SecuritySchemes["bearerAuth"]; !ok {
				t.Fatalf("bearerAuth scheme missing")
			}
		})
	}
}

func TestImportantRoutes(t *testing.T) {
	adminSpec, err := BuildAdminSpec()
	if err != nil {
		t.Fatalf("build admin spec: %v", err)
	}
	adminPath := adminSpec.Paths.Value("/v1/admin/overview")
	if adminPath == nil || adminPath.Get == nil {
		t.Fatalf("admin overview route missing")
	}
	if !containsTag(adminPath.Get.Tags, "Audit") {
		t.Fatalf("admin overview route missing Audit tag")
	}
}

func containsTag(tags []string, want string) bool {
	for _, tag := range tags {
		if tag == want {
			return true
		}
	}
	return false
}
