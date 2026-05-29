// Package markdown renders trusted Markdown to HTML (Goldmark + GFM-style extensions).
package markdown

import (
	"bytes"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/renderer/html"
)

// Renderer converts Markdown source to an HTML fragment.
type Renderer struct {
	md goldmark.Markdown
}

// NewRenderer builds a Goldmark pipeline with tables, strikethrough, task lists, and definition lists.
func NewRenderer() *Renderer {
	md := goldmark.New(
		goldmark.WithExtensions(
			extension.GFM,
			extension.DefinitionList,
		),
		goldmark.WithRendererOptions(html.WithUnsafe()),
	)
	return &Renderer{md: md}
}

// ToHTML converts markdown to HTML.
func (r *Renderer) ToHTML(src []byte) (string, error) {
	var buf bytes.Buffer
	if err := r.md.Convert(src, &buf); err != nil {
		return "", err
	}
	return buf.String(), nil
}
