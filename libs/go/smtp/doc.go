// Package smtp is Elvish's in-tree RFC 5321 SMTP stack.
//
// Subpackages:
//   - wire   — line/DATA framing, dot-stuffing, response codes
//   - sasl   — AUTH PLAIN / LOGIN server + client helpers
//   - server — TCP listener, session state machine, STARTTLS, AUTH plumbing
//   - client — outbound delivery (MX → connect → STARTTLS → MAIL/RCPT/DATA)
//
// Owning the wire layer in-tree keeps the supply chain narrow and lets us pin
// behaviour around custom backends (mailpipe.Ingest with gateway-encryption).
package smtp
