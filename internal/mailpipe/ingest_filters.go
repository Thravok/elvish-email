package mailpipe

import (
	"context"
	"encoding/json"
	"net/mail"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"elvish/internal/mailmeta"
)

const ingestFilterRulesCap = 50

type filterCondJSON struct {
	Type     string `json:"type"`
	Operator string `json:"operator"`
	Value    any    `json:"value"`
}

type filterActJSON struct {
	Type  string `json:"type"`
	Value any    `json:"value"`
}

type filterRowLite struct {
	Conditions []filterCondJSON
	Actions    []filterActJSON
}

// ingestFilterDecision is the outcome of privacy-preserving ingest-time rules.
type ingestFilterDecision struct {
	// Drop blocks persistence entirely (SMTP still returns success).
	Drop bool
	// TargetFolder is the Scylla folder when Drop is false; empty means inbox.
	TargetFolder string
}

// evalIngestPrivacyFilters applies the user's enabled filter rules before any blob write.
//
// Only conditions that can be evaluated from envelope + RFC822 header fields and raw
// byte length are considered: sender, recipient, subject, size, attachment. "body" and
// custom "header" conditions never match on the server so E2EE bodies are not scanned
// and rules that depend on decrypted body text still run client-side only.
func (p *Pipe) evalIngestPrivacyFilters(ctx context.Context, userID uuid.UUID, envelopeFrom, recipient string, rawBody []byte, hs HeaderSummary) (ingestFilterDecision, error) {
	var zero ingestFilterDecision
	if p == nil || p.Meta == nil {
		return zero, nil
	}
	rows, err := p.Meta.ListMailFilters(ctx, userID)
	if err != nil {
		return zero, err
	}
	rules := make([]filterRowLite, 0, len(rows))
	for _, r := range rows {
		if !r.Enabled {
			continue
		}
		var conds []filterCondJSON
		if err := json.Unmarshal(r.Conditions, &conds); err != nil {
			continue
		}
		var acts []filterActJSON
		if err := json.Unmarshal(r.Actions, &acts); err != nil {
			continue
		}
		rules = append(rules, filterRowLite{
			Conditions: conds,
			Actions:    acts,
		})
		if len(rules) >= ingestFilterRulesCap {
			break
		}
	}
	if len(rules) == 0 {
		return zero, nil
	}

	ctxVal := buildIngestFilterCtx(envelopeFrom, recipient, rawBody, hs)
	for _, rule := range rules {
		if !ingestRuleConditionsMatch(rule.Conditions, ctxVal) {
			continue
		}
		return ingestDecisionFromActions(ctx, p.Meta, userID, rule.Actions)
	}
	return zero, nil
}

func buildIngestFilterCtx(envelopeFrom, recipient string, rawBody []byte, hs HeaderSummary) ingestFilterCtx {
	rec := strings.ToLower(strings.TrimSpace(recipient))
	to := append([]string(nil), hs.To...)
	to = append(to, hs.Cc...)
	return ingestFilterCtx{
		envelopeFrom: strings.TrimSpace(envelopeFrom),
		headerFrom:   strings.TrimSpace(hs.From),
		subject:      hs.Subject,
		recipient:    rec,
		toAddrs:      to,
		sizeBytes:    int64(len(rawBody)),
		hasAttach:    len(hs.Attachments) > 0,
	}
}

type ingestFilterCtx struct {
	envelopeFrom string
	headerFrom   string
	subject      string
	recipient    string
	toAddrs      []string
	sizeBytes    int64
	hasAttach    bool
}

func ingestDecisionFromActions(ctx context.Context, meta *mailmeta.Store, userID uuid.UUID, acts []filterActJSON) (ingestFilterDecision, error) {
	var out ingestFilterDecision
	for _, a := range acts {
		if strings.ToLower(strings.TrimSpace(a.Type)) == "delete" {
			return ingestFilterDecision{Drop: true}, nil
		}
	}
	for _, a := range acts {
		t := strings.ToLower(strings.TrimSpace(a.Type))
		if t != "move" {
			continue
		}
		folder, err := resolveIngestMoveFolder(ctx, meta, userID, filterActString(a.Value))
		if err != nil {
			return ingestFilterDecision{}, err
		}
		if folder != "" && folder != mailmeta.FolderInbox {
			out.TargetFolder = folder
		}
		break
	}
	return out, nil
}

func resolveIngestMoveFolder(ctx context.Context, meta *mailmeta.Store, userID uuid.UUID, want string) (string, error) {
	want = strings.TrimSpace(strings.ToLower(want))
	if want == "" {
		return mailmeta.FolderInbox, nil
	}
	for _, s := range mailmeta.StandardFolders {
		if want == s {
			return want, nil
		}
	}
	if meta == nil {
		return mailmeta.FolderInbox, nil
	}
	ok, err := meta.UserHasFolder(ctx, userID, want)
	if err != nil {
		return "", err
	}
	if !ok {
		return mailmeta.FolderInbox, nil
	}
	return want, nil
}

func ingestRuleConditionsMatch(conds []filterCondJSON, ctx ingestFilterCtx) bool {
	if len(conds) == 0 {
		return false
	}
	for _, c := range conds {
		if !ingestConditionMatches(c, ctx) {
			return false
		}
	}
	return true
}

func ingestConditionMatches(c filterCondJSON, ctx ingestFilterCtx) bool {
	typ := strings.ToLower(strings.TrimSpace(c.Type))
	op := strings.ToLower(strings.TrimSpace(c.Operator))
	if op == "" {
		op = "contains"
	}
	val := strings.TrimSpace(filterCondString(c.Value))
	switch typ {
	case "sender":
		for _, hay := range senderHaystacks(ctx.envelopeFrom, ctx.headerFrom) {
			if matchStringFold(hay, val, op) {
				return true
			}
		}
		return false
	case "recipient":
		if ctx.recipient != "" && matchStringFold(ctx.recipient, val, op) {
			return true
		}
		for _, addr := range ctx.toAddrs {
			if matchStringFold(addr, val, op) {
				return true
			}
		}
		return false
	case "subject":
		return matchStringFold(ctx.subject, val, op)
	case "size":
		return ingestSizeMatches(op, val, ctx.sizeBytes)
	case "attachment":
		return ingestAttachmentMatches(val, ctx.hasAttach)
	case "body", "header":
		return false
	default:
		return false
	}
}

func senderHaystacks(envelopeFrom, headerFrom string) []string {
	seen := map[string]struct{}{}
	var out []string
	add := func(s string) {
		s = strings.TrimSpace(s)
		if s == "" {
			return
		}
		key := strings.ToLower(s)
		if _, ok := seen[key]; ok {
			return
		}
		seen[key] = struct{}{}
		out = append(out, s)
		if a, err := mail.ParseAddress(s); err == nil {
			em := strings.ToLower(strings.TrimSpace(a.Address))
			if em != "" {
				if _, ok := seen[em]; !ok {
					seen[em] = struct{}{}
					out = append(out, em)
				}
			}
		}
	}
	add(envelopeFrom)
	add(headerFrom)
	return out
}

func matchStringFold(hay, needle, operator string) bool {
	h := strings.ToLower(strings.TrimSpace(hay))
	n := strings.ToLower(strings.TrimSpace(needle))
	if n == "" && operator != "equals" {
		return false
	}
	switch operator {
	case "equals":
		return h == n
	case "starts_with":
		return strings.HasPrefix(h, n)
	case "ends_with":
		return strings.HasSuffix(h, n)
	case "matches", "contains":
		return n != "" && strings.Contains(h, n)
	default:
		return false
	}
}

func ingestSizeMatches(op, val string, sizeBytes int64) bool {
	n, err := strconv.ParseInt(strings.TrimSpace(val), 10, 64)
	if err != nil {
		return false
	}
	switch op {
	case "greater_than":
		return sizeBytes > n
	case "less_than":
		return sizeBytes < n
	case "equals":
		return sizeBytes == n
	default:
		return false
	}
}

func ingestAttachmentMatches(val string, has bool) bool {
	v := strings.ToLower(strings.TrimSpace(val))
	switch v {
	case "0", "false", "no":
		return !has
	default:
		return has
	}
}

func filterCondString(v any) string {
	switch t := v.(type) {
	case string:
		return t
	case float64:
		return strconv.FormatInt(int64(t), 10)
	case json.Number:
		return string(t)
	case nil:
		return ""
	default:
		b, err := json.Marshal(t)
		if err != nil {
			return ""
		}
		return strings.Trim(string(b), `"`)
	}
}

func filterActString(v any) string {
	return filterCondString(v)
}
