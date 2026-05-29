package httpserver

import (
	"compress/gzip"
	"io"
	"net/http"
	"strings"
	"sync"
)

var gzipWriterPool = sync.Pool{
	New: func() any {
		return gzip.NewWriter(io.Discard)
	},
}

func contentTypeGzipPrefix(ct string) bool {
	ct = strings.TrimSpace(strings.SplitN(ct, ";", 2)[0])
	switch ct {
	case "text/html", "text/css", "text/javascript", "application/javascript", "application/json",
		"application/xml", "text/xml", "text/plain", "application/rss+xml",
		"application/atom+xml", "application/feed+json", "text/markdown",
		"text/html; charset=utf-8", "text/css; charset=utf-8",
		"text/javascript; charset=utf-8",
		"application/javascript; charset=utf-8", "application/json; charset=utf-8",
		"application/xml; charset=utf-8", "text/xml; charset=utf-8",
		"text/plain; charset=utf-8", "application/rss+xml; charset=utf-8",
		"application/atom+xml; charset=utf-8", "application/feed+json; charset=utf-8",
		"text/markdown; charset=utf-8":
		return true
	default:
		return strings.HasPrefix(ct, "text/")
	}
}

// GzipHandler wraps h and compresses eligible responses when Accept-Encoding includes gzip.
func GzipHandler(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			h.ServeHTTP(w, r)
			return
		}
		if r.Header.Get("Range") != "" {
			h.ServeHTTP(w, r)
			return
		}
		gw := &gzipResponseWriter{ResponseWriter: w, req: r}
		h.ServeHTTP(gw, r)
		gw.close()
	})
}

type gzipResponseWriter struct {
	http.ResponseWriter
	req           *http.Request
	gw            *gzip.Writer
	headerWritten bool
	status        int
	skip          bool
}

func (w *gzipResponseWriter) WriteHeader(code int) {
	if w.headerWritten {
		return
	}
	w.status = code
	w.maybeStartGzip(code)
	if !w.headerWritten {
		w.ResponseWriter.WriteHeader(code)
		w.headerWritten = true
	}
}

func (w *gzipResponseWriter) maybeStartGzip(code int) {
	if w.headerWritten || w.skip {
		return
	}
	if w.req.Method == http.MethodHead {
		return
	}
	if code != http.StatusOK {
		return
	}
	if w.ResponseWriter.Header().Get("Content-Encoding") != "" {
		return
	}
	ct := w.ResponseWriter.Header().Get("Content-Type")
	if !contentTypeGzipPrefix(ct) {
		return
	}
	w.Header().Set("Content-Encoding", "gzip")
	w.Header().Add("Vary", "Accept-Encoding")
	w.Header().Del("Content-Length")

	gz := gzipWriterPool.Get().(*gzip.Writer)
	gz.Reset(w.ResponseWriter)
	w.gw = gz
	w.ResponseWriter.WriteHeader(code)
	w.headerWritten = true
}

func (w *gzipResponseWriter) Write(b []byte) (int, error) {
	if w.skip {
		return w.ResponseWriter.Write(b)
	}
	if !w.headerWritten {
		if w.status == 0 {
			w.status = http.StatusOK
		}
		w.maybeStartGzip(w.status)
		if !w.headerWritten {
			w.ResponseWriter.WriteHeader(w.status)
			w.headerWritten = true
		}
	}
	if w.gw != nil {
		return w.gw.Write(b)
	}
	return w.ResponseWriter.Write(b)
}

func (w *gzipResponseWriter) close() {
	if w.gw != nil {
		if err := w.gw.Close(); err == nil {
			gzipWriterPool.Put(w.gw)
		}
		w.gw = nil
	}
}

// Unwrap for stdlib Flush support if underlying supports Flusher.
func (w *gzipResponseWriter) Flush() {
	if w.gw != nil {
		_ = w.gw.Flush()
	}
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}
