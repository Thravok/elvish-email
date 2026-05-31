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

	"elvish/internal/blobstore"
	"elvish/internal/mailmeta"
	"elvish/internal/models"
	"elvish/internal/scyllastore"
	"elvish/internal/store"
)

type accountDeleteActionBody struct {
	SessionID      string `json:"session_id"`
	ClientProofB64 string `json:"client_proof_b64"`
	Confirmation   string `json:"confirmation"`
}

type accountDeletePolicyBody struct {
	Enabled *bool  `json:"enabled,omitempty"`
	Value   *int   `json:"value,omitempty"`
	Unit    string `json:"unit,omitempty"`
}

func (s *Server) decodeVerifiedAccountDeleteAction(w http.ResponseWriter, r *http.Request) (*models.User, []byte, bool) {
	if s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "database required")
		return nil, nil, false
	}
	u, ok := s.requireUser(w, r)
	if !ok {
		return nil, nil, false
	}
	if !s.requireRecentMFA(w, r, u) {
		return nil, nil, false
	}
	var body accountDeleteActionBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return nil, nil, false
	}
	if strings.TrimSpace(body.Confirmation) != "DELETE" {
		s.writeErr(w, http.StatusBadRequest, `confirmation must be "DELETE"`)
		return nil, nil, false
	}
	ch, ok, err := s.takeSRPChallenge(r.Context(), strings.TrimSpace(body.SessionID), "account-delete")
	if err != nil {
		s.writeErrAPIInternal(w, "delete srp challenge load", err)
		return nil, nil, false
	}
	if !ok || strings.TrimSpace(ch.UserID) != u.ID.String() {
		s.writeErr(w, http.StatusUnauthorized, "invalid credentials")
		return nil, nil, false
	}
	proof, err := decodeB64Field(body.ClientProofB64, "client_proof_b64")
	if err != nil || !bytes.Equal(proof, ch.ExpectedClientProof) {
		s.writeErr(w, http.StatusUnauthorized, "invalid credentials")
		return nil, nil, false
	}
	return u, ch.ServerProof, true
}

func (s *Server) apiAuthAccountDeleteNow(w http.ResponseWriter, r *http.Request) {
	u, serverProof, ok := s.decodeVerifiedAccountDeleteAction(w, r)
	if !ok {
		return
	}
	if err := s.purgeUserAccount(r.Context(), u.ID); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.writeErr(w, http.StatusNotFound, "user not found")
			return
		}
		s.writeErrAPIInternal(w, "purge user account", err)
		return
	}
	s.clearBrowserSession(w, r)
	s.writeJSON(w, http.StatusOK, map[string]any{
		"ok":               true,
		"server_proof_b64": base64.StdEncoding.EncodeToString(serverProof),
	})
}

func (s *Server) apiAuthAccountDeleteSchedule(w http.ResponseWriter, r *http.Request) {
	u, serverProof, ok := s.decodeVerifiedAccountDeleteAction(w, r)
	if !ok {
		return
	}
	deleteAt := time.Now().UTC().Add(7 * 24 * time.Hour)
	if err := s.store.ScheduleUserDeletion(r.Context(), u.ID, deleteAt, "user_requested"); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.writeErr(w, http.StatusNotFound, "user not found")
			return
		}
		s.writeErrAPIInternal(w, "schedule user deletion", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]any{
		"ok":               true,
		"server_proof_b64": base64.StdEncoding.EncodeToString(serverProof),
		"scheduled_delete": map[string]any{
			"at":     deleteAt.Format(time.RFC3339Nano),
			"reason": "user_requested",
		},
	})
}

func (s *Server) apiAuthAccountDeleteCancel(w http.ResponseWriter, r *http.Request) {
	if s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "database required")
		return
	}
	u, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	if err := s.store.CancelUserDeletion(r.Context(), u.ID); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.writeErr(w, http.StatusNotFound, "user not found")
			return
		}
		s.writeErrAPIInternal(w, "cancel user deletion", err)
		return
	}
	s.writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) apiAccountDeletePolicyGet(w http.ResponseWriter, r *http.Request) {
	if s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "database required")
		return
	}
	u, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	fresh, err := s.store.UserLifecycleByID(r.Context(), u.ID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.writeErr(w, http.StatusNotFound, "user not found")
			return
		}
		s.writeErrAPIInternal(w, "load delete policy", err)
		return
	}
	s.writeDeletePolicyJSON(w, fresh)
}

func (s *Server) apiAccountDeletePolicyPut(w http.ResponseWriter, r *http.Request) {
	if s.store == nil {
		s.writeErr(w, http.StatusServiceUnavailable, "database required")
		return
	}
	u, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	var body accountDeletePolicyBody
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		s.writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	enabled := body.Enabled != nil && *body.Enabled
	value := 0
	unit := ""
	if enabled {
		if body.Value == nil || *body.Value <= 0 {
			s.writeErr(w, http.StatusBadRequest, "value must be greater than zero when enabled")
			return
		}
		value = *body.Value
		unit = strings.TrimSpace(body.Unit)
	}
	if err := s.store.SetUserInactivityDeletion(r.Context(), u.ID, value, unit); err != nil {
		s.writeErrAPIInternal(w, "save delete policy", err)
		return
	}
	fresh, err := s.store.UserLifecycleByID(r.Context(), u.ID)
	if err != nil {
		s.writeErrAPIInternal(w, "reload delete policy", err)
		return
	}
	s.writeDeletePolicyJSON(w, fresh)
}

func (s *Server) writeDeletePolicyJSON(w http.ResponseWriter, u *models.User) {
	if u == nil {
		s.writeJSON(w, http.StatusOK, map[string]any{"policy": nil})
		return
	}
	scheduledAt := ""
	if u.ScheduledDeleteAt != nil {
		scheduledAt = u.ScheduledDeleteAt.UTC().Format(time.RFC3339Nano)
	}
	s.writeJSON(w, http.StatusOK, map[string]any{
		"policy": map[string]any{
			"enabled": u.InactivityDeleteValue > 0 && strings.TrimSpace(u.InactivityDeleteUnit) != "",
			"value":   u.InactivityDeleteValue,
			"unit":    u.InactivityDeleteUnit,
		},
		"last_activity_day":       u.LastActivityAt.UTC().Format("2006-01-02"),
		"scheduled_delete_at":     scheduledAt,
		"scheduled_delete_reason": u.ScheduledDeleteReason,
	})
}

func (s *Server) purgeUserAccount(ctx context.Context, userID uuid.UUID) error {
	if s == nil || s.store == nil {
		return errors.New("store: nil")
	}
	reservations, err := s.store.ListUserOwnedAddresses(ctx, userID)
	if err != nil {
		return err
	}
	domainReservations, err := s.store.ListUserOwnedDomains(ctx, userID)
	if err != nil {
		return err
	}
	reservations = append(reservations, domainReservations...)
	if err := s.store.ReserveDeletedAddresses(ctx, reservations); err != nil {
		return err
	}

	if err := s.deleteUserProtectedLinks(ctx, userID); err != nil {
		return err
	}

	var ingestRows []mailmeta.IngestLedger
	if s.mailmeta != nil {
		ingestRows, err = s.mailmeta.ListIngestLedgerByUser(ctx, userID)
		if err != nil {
			return err
		}
		outboxRows, err := s.mailmeta.ListOutboxByUser(ctx, userID)
		if err != nil {
			return err
		}
		for _, row := range outboxRows {
			if err := s.deleteBlobIfPresent(ctx, row.PayloadBlobRef); err != nil {
				return err
			}
		}
		domains, err := s.mailmeta.ListOwnedDomains(ctx, userID)
		if err != nil {
			return err
		}
		for _, domain := range domains {
			if err := s.mailmeta.DeleteOwnedDomain(ctx, userID, domain.Domain); err != nil && !errors.Is(err, mailmeta.ErrNotFound) {
				return err
			}
		}
	}
	if err := s.deleteUserMailboxData(ctx, userID, ingestRows); err != nil {
		return err
	}
	if s.sessions != nil {
		if err := s.sessions.DeleteUserSessions(ctx, userID); err != nil {
			return err
		}
	}
	return s.store.DeleteUser(ctx, userID)
}

func (s *Server) deleteUserProtectedLinks(ctx context.Context, userID uuid.UUID) error {
	if s.mailLinks == nil {
		return nil
	}
	rows, err := s.mailLinks.ListAllByUser(ctx, userID)
	if err != nil {
		return err
	}
	for _, row := range rows {
		if err := s.deleteBlobIfPresent(ctx, row.BlobRef); err != nil {
			return err
		}
		if err := s.mailLinks.Delete(ctx, row.Token); err != nil {
			return err
		}
	}
	return nil
}

func (s *Server) deleteUserMailboxData(ctx context.Context, userID uuid.UUID, ingestRows []mailmeta.IngestLedger) error {
	if len(ingestRows) > 0 && s.scylla == nil {
		return errors.New("mailbox purge requires scylla")
	}
	for _, row := range ingestRows {
		if err := s.deleteBlobIfPresent(ctx, row.BodyBlobRef); err != nil {
			return err
		}
		mf, err := s.scylla.GetManifest(ctx, userID, row.MessageID)
		if errors.Is(err, scyllastore.ErrNotFound) {
			continue
		}
		if err != nil {
			return err
		}
		if err := s.scylla.DeleteManifest(ctx, userID, mf.Folder, mf.CreatedAt, mf.MessageID); err != nil {
			return err
		}
	}
	if s.scylla == nil {
		return nil
	}
	if err := s.scylla.DeleteUserFlags(ctx, userID); err != nil {
		return err
	}
	if err := s.scylla.DeleteUserEvents(ctx, userID); err != nil {
		return err
	}
	if err := s.scylla.DeleteUserOptInMetadata(ctx, userID); err != nil {
		return err
	}
	for _, folder := range s.userMailboxFoldersForPurge(ctx, userID) {
		if err := s.scylla.DeleteMailboxPartition(ctx, userID, folder); err != nil {
			return err
		}
	}
	return nil
}

func (s *Server) userMailboxFoldersForPurge(ctx context.Context, userID uuid.UUID) []string {
	seen := map[string]struct{}{
		mailmeta.FolderInbox:   {},
		mailmeta.FolderSent:    {},
		mailmeta.FolderDrafts:  {},
		mailmeta.FolderArchive: {},
		mailmeta.FolderTrash:   {},
	}
	if s.mailmeta != nil {
		if folders, err := s.mailmeta.ListUserFolders(ctx, userID); err == nil {
			for _, folder := range folders {
				name := strings.TrimSpace(strings.ToLower(folder.Name))
				if name != "" {
					seen[name] = struct{}{}
				}
			}
		}
	}
	out := make([]string, 0, len(seen))
	for name := range seen {
		out = append(out, name)
	}
	return out
}

func (s *Server) deleteBlobIfPresent(ctx context.Context, key string) error {
	key = strings.TrimSpace(key)
	if key == "" {
		return nil
	}
	if s.blob == nil {
		return errors.New("blobstore required for account purge")
	}
	if err := s.blob.Delete(ctx, key); err != nil && !errors.Is(err, blobstore.ErrNotFound) {
		return err
	}
	return nil
}

// RunAccountDeletionLoop periodically processes scheduled and inactivity-triggered account deletions.
func (s *Server) RunAccountDeletionLoop(ctx context.Context) {
	for {
		if err := ctx.Err(); err != nil {
			return
		}
		if err := s.runAccountDeletionSweep(ctx, 100); err != nil && s.log != nil {
			s.log.Warn("account deletion sweep", "err", err)
		}
		if !uptimeSleep(ctx, 5*time.Minute) {
			return
		}
	}
}

func (s *Server) runAccountDeletionSweep(ctx context.Context, limit int) error {
	startedAt := time.Now()
	var sweepErr error
	defer func() {
		if s == nil || s.telemetry == nil {
			return
		}
		if err := s.telemetry.RecordJobRun(ctx, "account_deletion", sweepErr, time.Since(startedAt)); err != nil && s.log != nil {
			s.log.Warn("account deletion telemetry", "err", err)
		}
	}()
	if s == nil || s.store == nil {
		return nil
	}
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	now := time.Now().UTC()
	seen := make(map[uuid.UUID]struct{})
	scheduled, err := s.store.ListUsersDueForScheduledDeletion(ctx, now, limit)
	if err != nil {
		sweepErr = err
		return err
	}
	for _, user := range scheduled {
		seen[user.ID] = struct{}{}
		purgeStartedAt := time.Now()
		err := s.purgeUserAccount(ctx, user.ID)
		if s.telemetry != nil {
			if recErr := s.telemetry.RecordDependencyPerf(ctx, "account_delete", "user_purge", "background", err == nil, time.Since(purgeStartedAt)); recErr != nil && s.log != nil {
				s.log.Warn("account deletion purge telemetry", "err", recErr)
			}
		}
		if err != nil && !errors.Is(err, store.ErrNotFound) && s.log != nil {
			s.log.Warn("scheduled user deletion", "user_id", user.ID.String(), "err", err)
		}
	}
	inactive, err := s.store.ListUsersDueForInactivityDeletion(ctx, now, limit)
	if err != nil {
		sweepErr = err
		return err
	}
	for _, user := range inactive {
		if _, ok := seen[user.ID]; ok {
			continue
		}
		purgeStartedAt := time.Now()
		err := s.purgeUserAccount(ctx, user.ID)
		if s.telemetry != nil {
			if recErr := s.telemetry.RecordDependencyPerf(ctx, "account_delete", "user_purge", "background", err == nil, time.Since(purgeStartedAt)); recErr != nil && s.log != nil {
				s.log.Warn("account deletion purge telemetry", "err", recErr)
			}
		}
		if err != nil && !errors.Is(err, store.ErrNotFound) && s.log != nil {
			s.log.Warn("inactive user deletion", "user_id", user.ID.String(), "err", err)
		}
	}
	_, err = s.store.DeleteExpiredDeletedAddressReservations(ctx, now)
	sweepErr = err
	return err
}
