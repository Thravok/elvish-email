package apidoc

import (
	"context"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
)

func TestEmbeddedOpenAPILoads(t *testing.T) {
	t.Parallel()
	if len(embeddedOpenAPI) == 0 {
		t.Fatal("embedded openapi.yaml is empty — run: make openapi")
	}
	loader := openapi3.NewLoader()
	doc, err := loader.LoadFromData(embeddedOpenAPI)
	if err != nil {
		t.Fatalf("load embedded spec: %v", err)
	}
	if err := doc.Validate(context.Background()); err != nil {
		t.Fatalf("validate spec: %v", err)
	}
	if doc.Paths == nil || len(doc.Paths.Map()) < 10 {
		t.Fatalf("expected many paths, got %d", len(doc.Paths.Map()))
	}
}
