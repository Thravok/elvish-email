package httpserver

import (
	"context"

	"github.com/google/uuid"

	"elvish/internal/blobstore"
	"elvish/internal/scyllastore"
)

// OutboxPlainBody is the plaintext composition payload for operator/support sends.
type OutboxPlainBody struct {
	FromAddr string
	ToAddrs  []string
	Subject  string
	BodyText string
}

// Scylla returns the Scylla store when mail is wired.
func (s *Server) Scylla() *scyllastore.Store {
	if s == nil {
		return nil
	}
	return s.scylla
}

// Blob returns the blob store when mail is wired.
func (s *Server) Blob() *blobstore.Store {
	if s == nil {
		return nil
	}
	return s.blob
}

// SubmitSupportPlaintextOutbox queues a plaintext relay send as the given platform user.
func (s *Server) SubmitSupportPlaintextOutbox(ctx context.Context, userID uuid.UUID, body OutboxPlainBody) (uuid.UUID, error) {
	res, err := s.submitPlaintextOutboxWithContext(ctx, userID, outboxPlainBody{
		FromAddr: body.FromAddr,
		ToAddrs:  body.ToAddrs,
		Subject:  body.Subject,
		BodyText: body.BodyText,
	}, outboxSubmitOpts{Source: "console_support"})
	if err != nil {
		return uuid.Nil, err
	}
	return res.FirstOutboxID(), nil
}
