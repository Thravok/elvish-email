-- Elvish mailbox-scale data. Run on first boot of the Scylla cluster (or via scylla-init).
-- For dev compose: replication uses SimpleStrategy:1. For prod, swap to NetworkTopologyStrategy.

CREATE KEYSPACE IF NOT EXISTS elvish_mail
  WITH replication = {'class':'SimpleStrategy','replication_factor':1};

USE elvish_mail;

-- Per-message manifest (PGP-encrypted header blob + blob_ref to body in object storage).
CREATE TABLE IF NOT EXISTS message_manifest_by_id (
  message_id        uuid PRIMARY KEY,
  user_id           uuid,
  folder            text,
  body_blob_ref     text,
  body_size_bytes   bigint,
  attachments       list<frozen<tuple<uuid,text,bigint,text>>>,
  header_ciphertext blob,
  provenance        text,
  source            text,
  created_at        timestamp
);

-- Inbox listing index. Partition per (user_id, folder), cluster by descending received_at.
CREATE TABLE IF NOT EXISTS messages_by_mailbox (
  user_id          uuid,
  folder           text,
  received_at      timestamp,
  message_id       uuid,
  body_size_bytes  bigint,
  provenance       text,
  has_attachments  boolean,
  PRIMARY KEY ((user_id, folder), received_at, message_id)
) WITH CLUSTERING ORDER BY (received_at DESC, message_id DESC);

-- Message flags (read/starred/deleted/archived/labels).
CREATE TABLE IF NOT EXISTS message_flags_by_user (
  user_id    uuid,
  message_id uuid,
  read       boolean,
  starred    boolean,
  deleted    boolean,
  archived   boolean,
  labels     set<text>,
  updated_at timeuuid,
  PRIMARY KEY ((user_id), message_id)
);

-- Mailbox event stream (delivery, mark_read, delete, bounce, sent). TTL 90 days.
CREATE TABLE IF NOT EXISTS message_events_by_user (
  user_id    uuid,
  event_at   timestamp,
  event_id   timeuuid,
  kind       text,
  message_id uuid,
  detail     text,
  PRIMARY KEY ((user_id), event_at, event_id)
) WITH CLUSTERING ORDER BY (event_at DESC, event_id DESC)
  AND default_time_to_live = 7776000;

-- Sparse plaintext metadata projection for consented fields only.
CREATE TABLE IF NOT EXISTS opt_in_metadata_by_user (
  user_id        uuid,
  message_id     uuid,
  subject        text,
  from_addr      text,
  to_addrs       list<text>,
  sent_at        timestamp,
  thread_id      text,
  flags_summary  text,
  PRIMARY KEY ((user_id), message_id)
);
