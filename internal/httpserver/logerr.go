package httpserver

import (
	"net/http"
)

func (s *Server) logHTTPServer(msg string, err error) {
	if err != nil {
		s.log.Error("httpserver", "msg", msg, "err", err)
		return
	}
	s.log.Info("httpserver", "msg", msg)
}

// writeErrAPIInternal logs err and returns a generic JSON 500 body.
func (s *Server) writeErrAPIInternal(w http.ResponseWriter, msg string, err error) {
	s.logHTTPServer(msg, err)
	s.writeErr(w, http.StatusInternalServerError, "internal error")
}

// writeErrAPIUnavailable logs err and returns a generic JSON 503 body.
func (s *Server) writeErrAPIUnavailable(w http.ResponseWriter, msg string, err error) {
	s.logHTTPServer(msg, err)
	s.writeErr(w, http.StatusServiceUnavailable, "service temporarily unavailable")
}

// httpErrorInternal500 logs err and returns a generic HTML/plain 500 body.
func (s *Server) httpErrorInternal500(w http.ResponseWriter, err error) {
	if err != nil {
		s.log.Error("httpserver internal", "err", err)
	}
	setCacheInternalError(w)
	http.Error(w, "Internal Server Error", http.StatusInternalServerError)
}
