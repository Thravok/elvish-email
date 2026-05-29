// Package mailops provides mailbox move, delete, and retention sweep operations.
package mailops

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"elvish/libs/go/blobstore"
	"elvish/libs/go/mailmeta"
	"elvish/libs/go/scyllastore"
)

// Service coordinates mailbox operations across CockroachDB, Scylla, and blob storage.
type Service struct {
	Meta   *mailmeta.Store
	Scylla *scyllastore.Store
	Blob   *blobstore.Store
}

// MoveResult reports the result of moving one message into another folder.
type MoveResult struct {
	MessageID   uuid.UUID
	PriorFolder string
	Folder      string
}

// DeleteResult reports the result of permanently deleting one message.
type DeleteResult struct {
	MessageID uuid.UUID
	Folder    string
}

// SweepResult reports the outcome of one retention sweep pass.
type SweepResult struct {
	Purged int
	Failed int
}

// New constructs a mailbox operations service.
func New(meta *mailmeta.Store, scylla *scyllastore.Store, blob *blobstore.Store) *Service {
	return &Service{Meta: meta, Scylla: scylla, Blob: blob}
}

// MoveMessage moves a message into another folder and updates lifecycle tracking.
func (s *Service) MoveMessage(ctx context.Context, userID, messageID uuid.UUID, targetFolder string) (*MoveResult, error) {
	if s == nil || s.Meta == nil || s.Scylla == nil {
		return nil, errors.New("mailops: missing dependencies")
	}
	targetFolder = strings.TrimSpace(strings.ToLower(targetFolder))
	if targetFolder == "" {
		return nil, errors.New("mailops: target folder required")
	}
	if !isStandardFolder(targetFolder) {
		ok, err := s.Meta.UserHasFolder(ctx, userID, targetFolder)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, errors.New("mailops: unknown folder")
		}
	}
	mf, err := s.Scylla.GetManifest(ctx, userID, messageID)
	if err != nil {
		return nil, err
	}
	if mf.Folder == targetFolder {
		return &MoveResult{MessageID: messageID, PriorFolder: mf.Folder, Folder: targetFolder}, nil
	}
	oldFolder := mf.Folder
	oldEnteredAt := mf.CreatedAt
	if lc, err := s.Meta.GetMessageLifecycle(ctx, userID, messageID); err == nil && lc != nil {
		oldEnteredAt = lc.FolderEnteredAt
		oldFolder = lc.CurrentFolder
	}
	newEnteredAt := time.Now().UTC()
	row := scyllastore.MailboxRow{
		UserID:         mf.UserID,
		Folder:         targetFolder,
		ReceivedAt:     newEnteredAt,
		MessageID:      mf.MessageID,
		BodySizeBytes:  mf.BodySizeBytes,
		Provenance:     mf.Provenance,
		HasAttachments: mf.HasAttachments,
	}
	if err := s.Scylla.InsertMailboxRow(ctx, row); err != nil {
		return nil, err
	}
	if err := s.Scylla.UpdateManifestFolder(ctx, mf.MessageID, targetFolder); err != nil {
		_ = s.Scylla.DeleteMailboxRow(ctx, mf.UserID, targetFolder, newEnteredAt, mf.MessageID)
		return nil, err
	}
	if err := s.Scylla.DeleteMailboxRow(ctx, mf.UserID, oldFolder, oldEnteredAt, mf.MessageID); err != nil {
		_ = s.Scylla.UpdateManifestFolder(ctx, mf.MessageID, oldFolder)
		_ = s.Scylla.DeleteMailboxRow(ctx, mf.UserID, targetFolder, newEnteredAt, mf.MessageID)
		return nil, err
	}
	if err := s.Meta.UpsertMessageLifecycle(ctx, mailmeta.MessageLifecycle{
		UserID:          userID,
		MessageID:       messageID,
		CurrentFolder:   targetFolder,
		FolderEnteredAt: newEnteredAt,
	}); err != nil {
		_ = s.Scylla.InsertMailboxRow(ctx, scyllastore.MailboxRow{
			UserID:         mf.UserID,
			Folder:         oldFolder,
			ReceivedAt:     oldEnteredAt,
			MessageID:      mf.MessageID,
			BodySizeBytes:  mf.BodySizeBytes,
			Provenance:     mf.Provenance,
			HasAttachments: mf.HasAttachments,
		})
		_ = s.Scylla.UpdateManifestFolder(ctx, mf.MessageID, oldFolder)
		_ = s.Scylla.DeleteMailboxRow(ctx, mf.UserID, targetFolder, newEnteredAt, mf.MessageID)
		return nil, err
	}
	s.updateFolderFlags(ctx, userID, messageID, targetFolder)
	_ = s.Scylla.AppendEvent(ctx, userID, "move_folder", messageID, oldFolder+"->"+targetFolder)
	return &MoveResult{MessageID: messageID, PriorFolder: oldFolder, Folder: targetFolder}, nil
}

// DeletePermanent permanently deletes a message and its lifecycle metadata.
func (s *Service) DeletePermanent(ctx context.Context, userID, messageID uuid.UUID) (*DeleteResult, error) {
	if s == nil || s.Meta == nil || s.Scylla == nil || s.Blob == nil {
		return nil, errors.New("mailops: missing dependencies")
	}
	mf, err := s.Scylla.GetManifest(ctx, userID, messageID)
	if err != nil {
		return nil, err
	}
	folder := mf.Folder
	folderEnteredAt := mf.CreatedAt
	if lc, err := s.Meta.GetMessageLifecycle(ctx, userID, messageID); err == nil && lc != nil {
		folder = lc.CurrentFolder
		folderEnteredAt = lc.FolderEnteredAt
	}
	if err := s.Scylla.DeleteManifest(ctx, userID, folder, folderEnteredAt, messageID); err != nil {
		return nil, err
	}
	if err := s.Scylla.DeleteFlags(ctx, userID, messageID); err != nil {
		return nil, err
	}
	if err := s.Scylla.DeleteOptInMetadata(ctx, userID, messageID); err != nil {
		return nil, err
	}
	if err := s.Meta.DeleteMessageLifecycle(ctx, userID, messageID); err != nil {
		return nil, err
	}
	if err := s.Blob.Delete(ctx, mf.BodyBlobRef); err != nil && !errors.Is(err, blobstore.ErrNotFound) {
		return nil, err
	}
	_ = s.Scylla.AppendEvent(ctx, userID, "delete", messageID, folder)
	return &DeleteResult{MessageID: messageID, Folder: folder}, nil
}

// SweepExpired permanently deletes messages whose folder retention windows have elapsed.
func (s *Service) SweepExpired(ctx context.Context, limit int) (SweepResult, error) {
	if s == nil || s.Meta == nil {
		return SweepResult{}, errors.New("mailops: missing dependencies")
	}
	expired, err := s.Meta.ListExpiredMessages(ctx, limit)
	if err != nil {
		return SweepResult{}, err
	}
	var result SweepResult
	var lastErr error
	for _, item := range expired {
		if _, err := s.DeletePermanent(ctx, item.UserID, item.MessageID); err != nil {
			result.Failed++
			lastErr = fmt.Errorf("purge expired %s/%s: %w", item.UserID, item.MessageID, err)
			continue
		}
		result.Purged++
	}
	return result, lastErr
}

func (s *Service) updateFolderFlags(ctx context.Context, userID, messageID uuid.UUID, targetFolder string) {
	flags, err := s.Scylla.GetFlags(ctx, userID, messageID)
	if errors.Is(err, scyllastore.ErrNotFound) {
		flags = &scyllastore.Flags{}
	} else if err != nil {
		return
	}
	flags.Deleted = targetFolder == mailmeta.FolderTrash
	flags.Archived = targetFolder == mailmeta.FolderArchive
	_ = s.Scylla.SetFlags(ctx, userID, messageID, *flags)
}

func isStandardFolder(folder string) bool {
	for _, candidate := range mailmeta.StandardFolders {
		if candidate == folder {
			return true
		}
	}
	return false
}
