package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/getkin/kin-openapi/openapi3"

	"github.com/matjeroapps/admin/internal/openapi"
)

func main() {
	specs := []struct {
		path  string
		build func() (*openapi3.T, error)
	}{
		{path: "docs/api/admin/openapi.json", build: openapi.BuildAdminSpec},
	}

	for _, spec := range specs {
		doc, err := spec.build()
		if err != nil {
			fail(err)
		}
		data, err := openapi.MarshalDocument(doc)
		if err != nil {
			fail(err)
		}
		if err := os.MkdirAll(filepath.Dir(spec.path), 0o755); err != nil {
			fail(err)
		}
		if err := os.WriteFile(spec.path, data, 0o644); err != nil {
			fail(err)
		}
	}
}

func fail(err error) {
	_, _ = fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
