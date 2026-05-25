import React, { useEffect, useMemo, useRef } from "react";
import { Icons, FOLDERS } from "./mail-icons.jsx";
import { formatDate } from "./lib/mail-format-helpers.js";
import { messageEncryptionDisplay } from "./lib/mail-encryption-labels.js";
import { canonicalizeSenderId } from "./lib/mail-address.js";
import { SenderAvatar } from "./mail-sender-avatar.jsx";

function messageExpiryHint(m) {
  if (!m) return "";
  if (m.expired) return "Expired";
  if (m.expires_at) return `Expires ${formatDate(m.expires_at)}`;
  if (m.max_reads > 0) {
    const left = typeof m.reads_remaining === "number" ? m.reads_remaining : Math.max(0, m.max_reads - (m.reads || 0));
    return left === 1 ? "1 read left" : `${left} reads left`;
  }
  return "";
}

export function MessageList({
  messages,
  selectedIds,
  focusedId,
  onRowClick,
  onCheckboxClick,
  onSelectAllVisible,
  onClearSelection,
  onBulkArchive,
  onBulkTrash,
  onBulkRestoreInbox,
  onBulkDeletePermanent,
  onBulkMarkRead,
  bulkBusy,
  onMessageContextMenu,
  folder,
  onRefresh,
  onEmptyTrash,
  emptyTrashDisabled,
  loading,
  search,
  onSearchChange,
  senderProfiles,
  onCompose,
  listRef,
}) {
  const folderName = (FOLDERS.find((f) => f.id === folder) || {}).name || folder;
  const showFirstRunEmpty = !search && folder === "inbox" && typeof onCompose === "function";
  const showEmptyTrash = folder === "trash" && typeof onEmptyTrash === "function";
  const selectedSet = useMemo(() => new Set(selectedIds || []), [selectedIds]);
  const selectedCount = selectedIds ? selectedIds.length : 0;
  const allVisibleSelected = messages.length > 0 && messages.every((m) => selectedSet.has(m.id));
  const someVisibleSelected = messages.some((m) => selectedSet.has(m.id));
  const headerCheckRef = useRef(null);
  useEffect(() => {
    const el = headerCheckRef.current;
    if (!el) return;
    el.indeterminate = someVisibleSelected && !allVisibleSelected;
  }, [someVisibleSelected, allVisibleSelected]);
  return (
    <div className="mail-list-pane">
      <div className="mail-list-header">
        <div className="mail-list-title">
          {messages.length > 0 ? (
            <button
              type="button"
              ref={headerCheckRef}
              className={`mail-item-check mail-list-select-all${allVisibleSelected ? " checked" : ""}`}
              title={allVisibleSelected ? "Clear selection" : "Select all visible"}
              aria-label={allVisibleSelected ? "Clear selection" : "Select all visible messages"}
              onClick={() => (allVisibleSelected ? onClearSelection() : onSelectAllVisible())}
            >
              ✓
            </button>
          ) : null}
          <span className="folder-name">{folderName}</span>
          <span className="count">({messages.length})</span>
        </div>
        <div className="mail-list-actions">
          {showEmptyTrash ? (
            <button
              type="button"
              className="mail-action-btn danger"
              onClick={onEmptyTrash}
              disabled={!!emptyTrashDisabled}
              title="Permanently delete all messages in Trash"
            >
              {Icons.trash}
            </button>
          ) : null}
          <button type="button" className="mail-action-btn" onClick={onRefresh} title="Refresh">{Icons.refresh}</button>
        </div>
        <div></div>
      </div>
      <div className="mail-search-bar">
        <span className="mail-search-icon">{Icons.search}</span>
        <input
          className="mail-search-input"
          type="search"
          placeholder="Search encrypted mail…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search mail"
        />
      </div>
      {selectedCount > 1 ? (
        <div className="mail-list-bulk" role="toolbar" aria-label="Bulk actions">
          <span className="mail-list-bulk-count">{selectedCount} selected</span>
          <div className="mail-list-bulk-actions">
            {folder === "trash" ? (
              <>
                <button type="button" className="btn-sm" disabled={bulkBusy} onClick={onBulkRestoreInbox} title="Move selected to Inbox">
                  {Icons.inbox} Inbox
                </button>
                <button type="button" className="btn-sm danger" disabled={bulkBusy} onClick={onBulkDeletePermanent} title="Permanently delete selected">
                  {Icons.trash} Delete
                </button>
              </>
            ) : (
              <>
                {folder !== "archive" ? (
                  <button type="button" className="btn-sm" disabled={bulkBusy} onClick={onBulkArchive} title="Archive selected">
                    {Icons.archive} Archive
                  </button>
                ) : (
                  <button type="button" className="btn-sm" disabled={bulkBusy} onClick={onBulkRestoreInbox} title="Move selected to Inbox">
                    {Icons.inbox} Inbox
                  </button>
                )}
                <button type="button" className="btn-sm" disabled={bulkBusy} onClick={onBulkTrash} title="Move selected to Trash">
                  {Icons.trash} Trash
                </button>
                <button type="button" className="btn-sm" disabled={bulkBusy} onClick={onBulkMarkRead} title="Mark selected as read">
                  Mark read
                </button>
              </>
            )}
            <button type="button" className="btn-sm ghost" disabled={bulkBusy} onClick={onClearSelection}>
              Clear
            </button>
          </div>
        </div>
      ) : null}
      {loading ? (
        <div className="mail-loading" role="status" aria-live="polite"><div className="spinner"></div><span>Loading…</span></div>
      ) : messages.length === 0 ? (
        <div className="mail-list-empty" role="status">
          <div className="icon">{Icons.mail}</div>
          {showFirstRunEmpty ? (
            <>
              <div className="mail-list-empty-copy">
                Your inbox is ready. Send yourself a test message or compose your first encrypted email to confirm everything is working.
              </div>
              <button type="button" className="mail-list-empty-action" onClick={onCompose}>▸ COMPOSE FIRST EMAIL</button>
            </>
          ) : (
            <div>{search ? `No matching messages in ${folderName.toLowerCase()}` : `No messages in ${folderName.toLowerCase()}`}</div>
          )}
        </div>
      ) : (
        <ul
          ref={listRef}
          className="mail-list"
          role="listbox"
          aria-label={`${folderName} messages`}
          aria-multiselectable="true"
          tabIndex={0}
        >
          {messages.map((m) => {
            const enc = messageEncryptionDisplay(m.provenance);
            const expiryHint = messageExpiryHint(m);
            const senderLabel = m.from_addr || (m.headerDecrypted ? "(missing from)" : "[ENCRYPTED]");
            const senderId = canonicalizeSenderId(m.from_addr);
            const senderProfile = senderId ? senderProfiles[senderId] : null;
            const isSelected = selectedSet.has(m.id);
            const isFocused = focusedId === m.id;
            return (
              <li
                key={m.id}
                id={`mail-item-${m.id}`}
                role="option"
                aria-selected={isSelected}
                className={`mail-item ${isSelected ? "selected" : ""} ${isFocused ? "active" : ""} ${m.read ? "" : "unread"}`}
                onClick={(e) => onRowClick(m.id, e)}
                onContextMenu={(e) => onMessageContextMenu(e, m)}
              >
                <div className="mail-item-lead">
                  <button
                    type="button"
                    className={`mail-item-check${isSelected ? " checked" : ""}`}
                    title="Select"
                    aria-label={isSelected ? "Deselect message" : "Select message"}
                    aria-pressed={isSelected}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCheckboxClick(m.id, e);
                    }}
                  >
                    ✓
                  </button>
                  <SenderAvatar senderLabel={senderLabel} senderId={senderId} profile={senderProfile} />
                </div>
                <div className="mail-item-content">
                  <div className="mail-item-from">{senderLabel}</div>
                  <div className="mail-item-subject">{m.subject || (m.headerDecrypted ? "(no subject)" : "[ENCRYPTED]")}</div>
                  <div className="mail-item-preview dim">{m.preview || ""}</div>
                </div>
                <div className="mail-item-meta">
                  <span className="mail-item-time">{formatDate(m.received_at)}</span>
                  <div className="mail-item-flags">
                    <span className={`mail-flag ${enc.flagClass}`} title={enc.title}>{Icons.lock}</span>
                    {expiryHint ? <span className={`mail-flag expiry${m.expired ? " expired" : ""}`} title={expiryHint}>⏱</span> : null}
                    {m.has_attachments && <span className="mail-flag attachment" title="Attachments">{Icons.attach}</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function MessageContextMenu({ menu, actions }) {
  if (!menu) return null;
  return (
    <div
      className="mail-context-menu"
      style={{ left: menu.x, top: menu.y }}
      onClick={(e) => e.stopPropagation()}
      role="menu"
    >
      {(actions || []).map((action) => (
        <button
          key={action.id}
          type="button"
          role="menuitem"
          className={`mail-context-menu-item ${action.variant === "danger" ? "danger" : ""}`}
          onClick={() => action.onClick(menu.messageId)}
        >
          <span className="mail-context-menu-icon">{action.icon}</span>
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}
