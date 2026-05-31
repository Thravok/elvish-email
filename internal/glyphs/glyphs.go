// Package glyphs maps tool glyph keys to inline SVG markup matching the original ELVISH prototype.
package glyphs

import "html/template"

const svgProps = `class="glyph" width="100%" height="100%" viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="1.25"`

// SVG returns trusted inline SVG for a glyph name.
func SVG(name string) template.HTML {
	switch name {
	case "shroud":
		return template.HTML(`<svg ` + svgProps + `><rect x="14" y="14" width="52" height="52"/><rect x="22" y="22" width="36" height="36"/><line x1="14" y1="14" x2="66" y2="66"/><line x1="14" y1="40" x2="40" y2="14"/><line x1="40" y1="66" x2="66" y2="40"/></svg>`)
	case "tessera":
		return template.HTML(`<svg ` + svgProps + `><rect x="14" y="14" width="22" height="22"/><rect x="44" y="14" width="22" height="22"/><rect x="14" y="44" width="22" height="22"/><rect x="44" y="44" width="22" height="22"/><rect x="38" y="38" width="4" height="4" fill="currentColor"/></svg>`)
	case "cipher":
		return template.HTML(`<svg ` + svgProps + `><rect x="18" y="32" width="44" height="34"/><path d="M28 32 V22 a12 12 0 0 1 24 0 V32"/><circle cx="40" cy="48" r="3" fill="currentColor"/><line x1="40" y1="51" x2="40" y2="58"/></svg>`)
	case "ledger":
		return template.HTML(`<svg ` + svgProps + `><rect x="16" y="14" width="48" height="52"/><line x1="16" y1="26" x2="64" y2="26"/><line x1="40" y1="26" x2="40" y2="66"/><line x1="22" y1="36" x2="36" y2="36"/><line x1="44" y1="36" x2="58" y2="36"/><line x1="22" y1="46" x2="36" y2="46"/><line x1="44" y1="46" x2="58" y2="46"/><line x1="22" y1="56" x2="36" y2="56"/><line x1="44" y1="56" x2="58" y2="56"/></svg>`)
	case "vector":
		return template.HTML(`<svg ` + svgProps + `><circle cx="20" cy="60" r="4" fill="currentColor"/><circle cx="40" cy="20" r="4" fill="currentColor"/><circle cx="60" cy="60" r="4" fill="currentColor"/><line x1="20" y1="60" x2="40" y2="20"/><line x1="40" y1="20" x2="60" y2="60"/><line x1="20" y1="60" x2="60" y2="60" stroke-dasharray="2 3"/></svg>`)
	case "loom":
		return template.HTML(`<svg ` + svgProps + `><rect x="18" y="14" width="44" height="52"/><line x1="24" y1="24" x2="56" y2="24"/><line x1="24" y1="32" x2="50" y2="32"/><line x1="24" y1="40" x2="56" y2="40"/><line x1="24" y1="48" x2="46" y2="48"/><line x1="24" y1="56" x2="56" y2="56"/></svg>`)
	case "hex":
		return template.HTML(`<svg ` + svgProps + `><polygon points="40,12 64,26 64,54 40,68 16,54 16,26"/><polygon points="40,26 52,33 52,47 40,54 28,47 28,33"/><line x1="40" y1="12" x2="40" y2="26"/><line x1="64" y1="26" x2="52" y2="33"/><line x1="64" y1="54" x2="52" y2="47"/></svg>`)
	case "sigil":
		return template.HTML(`<svg ` + svgProps + `><rect x="14" y="14" width="14" height="14"/><rect x="52" y="14" width="14" height="14"/><rect x="14" y="52" width="14" height="14"/><rect x="18" y="18" width="6" height="6" fill="currentColor"/><rect x="56" y="18" width="6" height="6" fill="currentColor"/><rect x="18" y="56" width="6" height="6" fill="currentColor"/><rect x="36" y="36" width="8" height="8" fill="currentColor"/><line x1="36" y1="14" x2="44" y2="14"/><line x1="36" y1="22" x2="44" y2="22"/><line x1="56" y1="36" x2="66" y2="36"/><line x1="56" y1="44" x2="66" y2="44"/></svg>`)
	case "drift":
		return template.HTML(`<svg ` + svgProps + `><circle cx="22" cy="58" r="3" fill="currentColor"/><path d="M22 44 a14 14 0 0 1 14 14"/><path d="M22 30 a28 28 0 0 1 28 28"/><path d="M22 16 a42 42 0 0 1 42 42"/></svg>`)
	case "obscura":
		return template.HTML(`<svg ` + svgProps + `><rect x="14" y="22" width="52" height="36"/><circle cx="40" cy="40" r="8"/><rect x="34" y="22" width="12" height="36" fill="currentColor" fill-opacity="0.15"/><line x1="14" y1="22" x2="66" y2="58" stroke-dasharray="2 3"/></svg>`)
	case "monolith":
		return template.HTML(`<svg ` + svgProps + `><rect x="28" y="10" width="24" height="60"/><line x1="28" y1="20" x2="52" y2="20"/><line x1="28" y1="30" x2="52" y2="30"/><line x1="28" y1="40" x2="52" y2="40"/><line x1="28" y1="50" x2="52" y2="50"/><line x1="28" y1="60" x2="52" y2="60"/></svg>`)
	case "echo":
		return template.HTML(`<svg ` + svgProps + `><line x1="14" y1="40" x2="20" y2="40"/><line x1="24" y1="32" x2="24" y2="48"/><line x1="30" y1="24" x2="30" y2="56"/><line x1="36" y1="30" x2="36" y2="50"/><line x1="42" y1="22" x2="42" y2="58"/><line x1="48" y1="34" x2="48" y2="46"/><line x1="54" y1="28" x2="54" y2="52"/><line x1="60" y1="36" x2="60" y2="44"/><line x1="64" y1="40" x2="70" y2="40"/></svg>`)
	default:
		return template.HTML(`<svg ` + svgProps + `><rect x="14" y="14" width="52" height="52"/></svg>`)
	}
}
