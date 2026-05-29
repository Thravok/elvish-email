package httpserver

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"elvish/libs/go/models"
	"elvish/libs/go/pake"
	"elvish/libs/go/store"
)

const srpChallengeTTL = 5 * time.Minute

// rejectFilledAuthHoneypot rejects non-empty anti-bot honeypot fields (must stay empty for real clients).
func (s *Server) rejectFilledAuthHoneypot(w http.ResponseWriter, company string) bool {
	if strings.TrimSpace(company) != "" {
		s.writeErr(w, http.StatusBadRequest, "invalid request")
		return false
	}
	return true
}

type srpChallenge struct {
	Purpose             string
	UserID              string
	ExpectedClientProof []byte
	ServerProof         []byte
	CreatedAt           time.Time
	Dummy               bool
}

type srpBeginBody struct {
	Username        string `json:"username,omitempty"`
	ClientPublicB64 string `json:"client_public_b64"`
	Company         string `json:"company,omitempty"`
	CapToken        string `json:"cap_token,omitempty"`
}

type srpFinishBody struct {
	SessionID      string `json:"session_id"`
	ClientProofB64 string `json:"client_proof_b64"`
	Company        string `json:"company,omitempty"`
}

func (s *Server) issueSRPChallenge(ctx context.Context, ch *srpChallenge) (string, error) {
	if ch == nil {
		return "", errors.New("srp challenge required")
	}
	ch.CreatedAt = time.Now()
	id := uuid.NewString()
	if s.sessions != nil {
		if err := s.sessions.PutEphemeralJSON(ctx, "srpchallenge", id, ch, srpChallengeTTL); err != nil {
			return "", err
		}
		return id, nil
	}
	s.authMu.Lock()
	defer s.authMu.Unlock()
	now := time.Now()
	for existingID, existing := range s.authChallenges {
		if existing == nil || now.Sub(existing.CreatedAt) > srpChallengeTTL {
			delete(s.authChallenges, existingID)
		}
	}
	s.authChallenges[id] = ch
	return id, nil
}

func (s *Server) takeSRPChallenge(ctx context.Context, id, purpose string) (*srpChallenge, bool, error) {
	if s.sessions != nil {
		var ch srpChallenge
		ok, err := s.sessions.TakeEphemeralJSON(ctx, "srpchallenge", id, &ch)
		if err != nil {
			return nil, false, err
		}
		if ok {
			if purpose != "" && ch.Purpose != purpose {
				return nil, false, nil
			}
			if time.Since(ch.CreatedAt) > srpChallengeTTL {
				return nil, false, nil
			}
			return &ch, true, nil
		}
	}
	s.authMu.Lock()
	defer s.authMu.Unlock()
	ch, ok := s.authChallenges[id]
	if !ok || ch == nil {
		return nil, false, nil
	}
	delete(s.authChallenges, id)
	if purpose != "" && ch.Purpose != purpose {
		return nil, false, nil
	}
	if time.Since(ch.CreatedAt) > srpChallengeTTL {
		return nil, false, nil
	}
	return ch, true, nil
}

func dummySRPRegistration(username string) (salt, verifier []byte, groupName, hashName string, err error) {
	salt, err = pake.RandomSalt(16)
	if err != nil {
		return nil, nil, "", "", err
	}
	reg, err := pake.ComputeRegistration(username, "dummy-password-for-missing-user", salt)
	if err != nil {
		return nil, nil, "", "", err
	}
	return salt, reg.Verifier, reg.GroupName, reg.HashName, nil
}

func decodeB64Field(v, name string) ([]byte, error) {
	out, err := base64.StdEncoding.DecodeString(strings.TrimSpace(v))
	if err != nil || len(out) == 0 {
		return nil, errors.New("invalid " + name)
	}
	return out, nil
}

func loadSRPUserForEmail(ctx context.Context, st *store.Store, email string) (*models.User, bool, error) {
	if st == nil {
		return nil, false, errors.New("store unavailable")
	}
	u, err := st.UserAuthByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return nil, false, nil
		}
		return nil, false, err
	}
	if store.IsDisabledUser(u) {
		return nil, false, nil
	}
	if strings.TrimSpace(u.AuthMethod) != "srp" || len(u.SRPSalt) == 0 || len(u.SRPVerifier) == 0 {
		return nil, false, nil
	}
	return u, true, nil
}

func (s *Server) apiLoginSRPBegin(w http.ResponseWriter, r *http.Request) {
	if s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "login requires database")
		return
	}
	if !s.rateLimitOK(w, r, "auth_login_srp_begin", rateLimitAuthPerHour, rateLimitAuthWindow) {
		return
	}
	var body srpBeginBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if !s.rejectFilledAuthHoneypot(w, body.Company) {
		return
	}
	if !s.requireCapToken(w, r, body.CapToken) {
		return
	}
	user, err := NormalizeAndValidateUsername(body.Username)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid username")
		return
	}
	clientPublic, err := decodeB64Field(body.ClientPublicB64, "client_public_b64")
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	email := ComposeCanonicalEmail(user, s.EffectiveMailDomain())
	authUser, ok, err := loadSRPUserForEmail(r.Context(), s.store, email)
	if err != nil {
		s.writeErrAPIInternal(w, "srp begin user lookup", err)
		return
	}
	regDummy := false
	var salt, verifier []byte
	var groupName, hashName string
	if ok {
		salt = append([]byte(nil), authUser.SRPSalt...)
		verifier = append([]byte(nil), authUser.SRPVerifier...)
		groupName = authUser.SRPGroup
		hashName = authUser.SRPHash
	} else {
		regDummy = true
		salt, verifier, groupName, hashName, err = dummySRPRegistration(user)
		if err != nil {
			s.writeErrAPIInternal(w, "srp dummy", err)
			return
		}
	}
	if _, err := pake.ParseGroup(groupName, hashName); err != nil {
		s.writeErrAPIInternal(w, "srp params", err)
		return
	}
	sess, err := pake.NewServerSession(user, salt, verifier, clientPublic)
	if err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid client public")
		return
	}
	userID := ""
	if authUser != nil {
		userID = authUser.ID.String()
	}
	chID, err := s.issueSRPChallenge(r.Context(), &srpChallenge{
		Purpose:             "login",
		UserID:              userID,
		ExpectedClientProof: sess.ExpectedClientProof(),
		ServerProof:         sess.ServerProof(),
		Dummy:               regDummy,
	})
	if err != nil {
		s.writeErrAPIInternal(w, "srp challenge store", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{
		"session_id":        chID,
		"salt_b64":          base64.StdEncoding.EncodeToString(salt),
		"server_public_b64": base64.StdEncoding.EncodeToString(sess.ServerPublic()),
		"group":             pake.DefaultGroup().Name,
		"hash":              "sha256",
	})
}

func (s *Server) apiLoginSRPFinish(w http.ResponseWriter, r *http.Request) {
	if s.store == nil || s.sessions == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "login requires database and Valkey")
		return
	}
	if !s.rateLimitOK(w, r, "auth_login_srp_finish", rateLimitAuthPerHour, rateLimitAuthWindow) {
		return
	}
	var body srpFinishBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if !s.rejectFilledAuthHoneypot(w, body.Company) {
		return
	}
	ch, ok, err := s.takeSRPChallenge(r.Context(), strings.TrimSpace(body.SessionID), "login")
	if err != nil {
		s.writeErrAPIInternal(w, "srp challenge load", err)
		return
	}
	if !ok {
		s.writeErr(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	proof, err := decodeB64Field(body.ClientProofB64, "client_proof_b64")
	if err != nil || !bytes.Equal(proof, ch.ExpectedClientProof) || ch.Dummy || strings.TrimSpace(ch.UserID) == "" {
		s.writeErr(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	uid, err := uuid.Parse(strings.TrimSpace(ch.UserID))
	if err != nil {
		s.writeErr(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	u, err := s.store.UserByID(r.Context(), uid)
	if err != nil {
		s.writeErr(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	challengeID, methods, err := s.createPendingLogin(r.Context(), u, "srp")
	if err != nil {
		s.writeErrAPIInternal(w, "srp mfa status", err)
		return
	}
	if challengeID != "" {
		s.writeJSON(w, http.StatusOK, map[string]any{
			"ok":               true,
			"mfa_required":     true,
			"challenge_id":     challengeID,
			"methods":          methods,
			"user":             userAuthJSON(u),
			"server_proof_b64": base64.StdEncoding.EncodeToString(ch.ServerProof),
		})
		return
	}
	if err := s.issueLoginSession(w, r.Context(), u, []string{"pwd", "srp"}, false); err != nil {
		s.writeErrAPIInternal(w, "srp issue session", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{
		"ok":               true,
		"user":             userAuthJSON(u),
		"server_proof_b64": base64.StdEncoding.EncodeToString(ch.ServerProof),
	})
}
