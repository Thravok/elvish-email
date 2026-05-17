package httpserver

import (
	"testing"
)

func TestIsValidDomain(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  bool
	}{
		{"valid domain", "example.com", true},
		{"valid subdomain", "mail.example.com", true},
		{"valid with hyphen", "my-domain.co.uk", true},
		{"empty", "", false},
		{"no dot", "localhost", false},
		{"too short", "a.b", false},
		{"has scheme", "https://example.com", false},
		{"has path", "example.com/path", false},
		{"has port", "example.com:443", false},
		{"uppercase", "EXAMPLE.COM", false},
		{"has underscore", "my_domain.com", false},
		{"valid numeric", "123.456.789.com", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isValidDomain(tt.input)
			if got != tt.want {
				t.Errorf("isValidDomain(%q) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

func TestExtractBIMILogoURL(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "valid BIMI record",
			input: "v=bimi1; l=https://example.com/logo.svg",
			want:  "https://example.com/logo.svg",
		},
		{
			name:  "with authority tag",
			input: "v=bimi1; l=https://example.com/logo.svg; a=https://example.com/cert.pem",
			want:  "https://example.com/logo.svg",
		},
		{
			name:  "no logo tag",
			input: "v=bimi1; a=https://example.com/cert.pem",
			want:  "",
		},
		{
			name:  "empty",
			input: "",
			want:  "",
		},
		{
			name:  "logo only extracts l tag",
			input: "v=bimi2; l=https://example.com/logo.svg",
			want:  "https://example.com/logo.svg",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractBIMILogoURL(tt.input)
			if got != tt.want {
				t.Errorf("extractBIMILogoURL(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestIsSVGContentType(t *testing.T) {
	tests := []struct {
		ct   string
		want bool
	}{
		{"image/svg+xml", true},
		{"image/svg+xml; charset=utf-8", true},
		{"IMAGE/SVG+XML", true},
		{"image/png", false},
		{"text/html", false},
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.ct, func(t *testing.T) {
			if got := isSVGContentType(tt.ct); got != tt.want {
				t.Errorf("isSVGContentType(%q) = %v, want %v", tt.ct, got, tt.want)
			}
		})
	}
}

func TestSanitizeSVG(t *testing.T) {
	tests := []struct {
		name string
		data string
		want bool
	}{
		{
			name: "clean SVG",
			data: `<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>`,
			want: true,
		},
		{
			name: "has script tag",
			data: `<svg><script>alert('xss')</script></svg>`,
			want: false,
		},
		{
			name: "has onclick",
			data: `<svg onclick="alert('xss')"><rect/></svg>`,
			want: false,
		},
		{
			name: "has onload",
			data: `<svg onload="alert('xss')"><rect/></svg>`,
			want: false,
		},
		{
			name: "has javascript URL",
			data: `<svg><a href="javascript:alert('xss')"><rect/></a></svg>`,
			want: false,
		},
		{
			name: "has foreignObject",
			data: `<svg><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></body></foreignObject></svg>`,
			want: false,
		},
		{
			name: "has use element",
			data: `<svg><use href="#myid"/></svg>`,
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := sanitizeSVG([]byte(tt.data)); got != tt.want {
				t.Errorf("sanitizeSVG() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestDetectImageMIME(t *testing.T) {
	tests := []struct {
		name        string
		contentType string
		data        []byte
		want        string
	}{
		{
			name:        "PNG by content-type",
			contentType: "image/png",
			data:        []byte{},
			want:        "image/png",
		},
		{
			name:        "PNG by magic bytes",
			contentType: "application/octet-stream",
			data:        []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A},
			want:        "image/png",
		},
		{
			name:        "ICO by magic bytes",
			contentType: "",
			data:        []byte{0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x10, 0x10},
			want:        "image/x-icon",
		},
		{
			name:        "JPEG by magic bytes",
			contentType: "",
			data:        []byte{0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46},
			want:        "image/jpeg",
		},
		{
			name:        "GIF by magic bytes",
			contentType: "",
			data:        []byte{0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00},
			want:        "image/gif",
		},
		{
			name:        "unknown",
			contentType: "",
			data:        []byte{0x00, 0x00, 0x00, 0x00},
			want:        "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := detectImageMIME(tt.contentType, tt.data); got != tt.want {
				t.Errorf("detectImageMIME() = %q, want %q", got, tt.want)
			}
		})
	}
}
