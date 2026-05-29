package apidoc

import _ "embed"

//go:embed openapi.yaml
var embeddedOpenAPI []byte

// OpenAPIYAML returns the merged OpenAPI 3 document (regenerate with `make openapi`).
func OpenAPIYAML() []byte {
	return embeddedOpenAPI
}
