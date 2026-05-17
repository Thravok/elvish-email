// Package wire implements RFC 5321 line + DATA framing.
package wire

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/textproto"
	"strconv"
	"strings"
)

// MaxLineBytes is the maximum command line size (RFC 5321 §4.5.3.1.4).
const MaxLineBytes = 8192

// MaxRecipients caps RCPT TO commands per session (sane default).
const MaxRecipients = 100

// SMTPError is a typed code/message pair for SMTP responses.
type SMTPError struct {
	Code         int
	EnhancedCode string
	Message      string
}

// Error implements error.
func (e *SMTPError) Error() string {
	if e == nil {
		return "smtp: nil"
	}
	if e.EnhancedCode != "" {
		return fmt.Sprintf("smtp %d %s: %s", e.Code, e.EnhancedCode, e.Message)
	}
	return fmt.Sprintf("smtp %d: %s", e.Code, e.Message)
}

// IsTransient reports whether the SMTP code falls in the 4xx temporary-failure range.
func (e *SMTPError) IsTransient() bool {
	return e != nil && e.Code/100 == 4
}

// IsPermanent reports whether the SMTP code falls in the 5xx permanent-failure range.
func (e *SMTPError) IsPermanent() bool {
	return e != nil && e.Code/100 == 5
}

// Common reusable error responses.
var (
	ErrLineTooLong     = &SMTPError{Code: 500, EnhancedCode: "5.5.6", Message: "line too long"}
	ErrSyntax          = &SMTPError{Code: 500, EnhancedCode: "5.5.2", Message: "syntax error"}
	ErrBadSequence     = &SMTPError{Code: 503, EnhancedCode: "5.5.1", Message: "bad sequence of commands"}
	ErrAuthRequired    = &SMTPError{Code: 530, EnhancedCode: "5.7.0", Message: "authentication required"}
	ErrTooManyRcpts    = &SMTPError{Code: 452, EnhancedCode: "4.5.3", Message: "too many recipients"}
	ErrMessageTooLarge = &SMTPError{Code: 552, EnhancedCode: "5.3.4", Message: "message too large"}
	ErrUnknownCommand  = &SMTPError{Code: 502, EnhancedCode: "5.5.1", Message: "command not implemented"}
	ErrTLSRequired     = &SMTPError{Code: 530, EnhancedCode: "5.7.0", Message: "must issue a STARTTLS command first"}
	ErrAuthFailed      = &SMTPError{Code: 535, EnhancedCode: "5.7.8", Message: "authentication failed"}
)

// Reader reads SMTP command lines from a connection.
type Reader struct {
	r *bufio.Reader
}

// NewReader wraps r in an SMTP-aware Reader (8192-byte line cap).
func NewReader(r io.Reader) *Reader {
	return &Reader{r: bufio.NewReaderSize(r, MaxLineBytes)}
}

// ReadLine reads one CRLF-terminated command line, stripping the CRLF.
// Returns ErrLineTooLong (as *SMTPError) when the line exceeds MaxLineBytes.
func (r *Reader) ReadLine() (string, error) {
	line, err := r.r.ReadString('\n')
	if err != nil && err != io.EOF {
		return "", err
	}
	if line == "" && err == io.EOF {
		return "", io.EOF
	}
	if len(line) > MaxLineBytes {
		return "", ErrLineTooLong
	}
	line = strings.TrimRight(line, "\r\n")
	return line, nil
}

// ReadDATA reads dot-stuffed lines until ".\r\n" and returns the de-stuffed message.
// limit caps the total bytes returned (returns ErrMessageTooLarge when exceeded).
func (r *Reader) ReadDATA(limit int) ([]byte, error) {
	tp := textproto.NewReader(r.r)
	body, err := tp.ReadDotBytes()
	if err != nil {
		return nil, err
	}
	if limit > 0 && len(body) > limit {
		return nil, ErrMessageTooLarge
	}
	return body, nil
}

// Writer writes SMTP responses.
type Writer struct {
	w *bufio.Writer
}

// NewWriter wraps w with a buffer.
func NewWriter(w io.Writer) *Writer {
	return &Writer{w: bufio.NewWriter(w)}
}

// Reply writes a single-line reply and flushes.
func (w *Writer) Reply(code int, msg string) error {
	_, err := fmt.Fprintf(w.w, "%d %s\r\n", code, msg)
	if err != nil {
		return err
	}
	return w.w.Flush()
}

// MultiReply writes a multi-line reply (every line gets the same code; '-' separator on continuations).
func (w *Writer) MultiReply(code int, lines []string) error {
	if len(lines) == 0 {
		return nil
	}
	for i, l := range lines {
		sep := "-"
		if i == len(lines)-1 {
			sep = " "
		}
		if _, err := fmt.Fprintf(w.w, "%d%s%s\r\n", code, sep, l); err != nil {
			return err
		}
	}
	return w.w.Flush()
}

// ReplyErr writes an SMTPError or a generic 451.
func (w *Writer) ReplyErr(err error) error {
	var se *SMTPError
	if errors.As(err, &se) {
		return w.Reply(se.Code, se.Message)
	}
	if err != nil {
		return w.Reply(451, "internal error: "+sanitize(err.Error()))
	}
	return nil
}

func sanitize(s string) string {
	if len(s) > 200 {
		s = s[:200]
	}
	return strings.Map(func(r rune) rune {
		if r == '\r' || r == '\n' {
			return ' '
		}
		return r
	}, s)
}

// ParseCommand splits "VERB ARGS" into upper-case verb + remainder.
func ParseCommand(line string) (verb, args string) {
	idx := strings.IndexByte(line, ' ')
	if idx < 0 {
		return strings.ToUpper(line), ""
	}
	return strings.ToUpper(line[:idx]), strings.TrimLeft(line[idx+1:], " ")
}

// ParseMailFromOrRcptTo extracts the address inside `FROM:<addr>` or `TO:<addr>` (extension args ignored).
func ParseMailFromOrRcptTo(args string) (string, error) {
	args = strings.TrimSpace(args)
	if len(args) < 4 {
		return "", ErrSyntax
	}
	upper := strings.ToUpper(args)
	var rest string
	switch {
	case strings.HasPrefix(upper, "FROM:"):
		rest = args[5:]
	case strings.HasPrefix(upper, "TO:"):
		rest = args[3:]
	default:
		return "", ErrSyntax
	}
	rest = strings.TrimLeft(rest, " ")
	if !strings.HasPrefix(rest, "<") {
		return "", ErrSyntax
	}
	end := strings.IndexByte(rest, '>')
	if end < 0 {
		return "", ErrSyntax
	}
	return strings.TrimSpace(rest[1:end]), nil
}

// ParseHelloName extracts the EHLO/HELO domain or address-literal argument.
func ParseHelloName(args string) (string, error) {
	args = strings.TrimSpace(args)
	if args == "" {
		return "", ErrSyntax
	}
	for _, r := range args {
		if r < 0x20 || r > 0x7E {
			return "", ErrSyntax
		}
	}
	return args, nil
}

// CodeFromError extracts the numeric SMTP code, defaulting to 451.
func CodeFromError(err error) int {
	var se *SMTPError
	if errors.As(err, &se) {
		return se.Code
	}
	return 451
}

// CodeFromText parses leading 3-digit SMTP code from a server reply line ("250 OK", "421-foo").
func CodeFromText(line string) (int, string, error) {
	if len(line) < 4 {
		return 0, "", errors.New("smtp: short response")
	}
	codeS := line[:3]
	code, err := strconv.Atoi(codeS)
	if err != nil {
		return 0, "", err
	}
	rest := strings.TrimSpace(line[4:])
	return code, rest, nil
}

// MessageHasCRLF inspects a payload looking for at least one CRLF (used as a sanity check).
func MessageHasCRLF(b []byte) bool {
	return bytes.Contains(b, []byte("\r\n"))
}
