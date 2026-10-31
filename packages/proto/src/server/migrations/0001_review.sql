CREATE TABLE proto_schema (version integer NOT NULL);
CREATE TABLE proto_keys (
  key text PRIMARY KEY, next_comment integer NOT NULL DEFAULT 1,
  review_status text NOT NULL DEFAULT 'in_review', review_updated_at timestamptz, extra jsonb
);
CREATE TABLE proto_events (
  id uuid PRIMARY KEY, key text NOT NULL REFERENCES proto_keys(key), position integer NOT NULL, type text NOT NULL,
  at timestamptz NOT NULL, author_kind text NOT NULL, author_id text, author_name text,
  commit text, open_count integer NOT NULL, comment_id text, extra jsonb
);
CREATE TABLE proto_comments (
  key text NOT NULL REFERENCES proto_keys(key), number integer NOT NULL,
  status text NOT NULL, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
  resolved_at timestamptz, context jsonb NOT NULL, target jsonb NOT NULL, extra jsonb,
  PRIMARY KEY (key, number)
);
CREATE TABLE proto_messages (
  id text PRIMARY KEY, key text NOT NULL, number integer NOT NULL, position integer NOT NULL,
  author_kind text NOT NULL, author_id text, author_name text, body text NOT NULL,
  at timestamptz NOT NULL, edited_at timestamptz, extra jsonb,
  FOREIGN KEY (key, number) REFERENCES proto_comments(key, number) ON DELETE CASCADE
);
CREATE TABLE proto_attachments (
  id text PRIMARY KEY, key text NOT NULL REFERENCES proto_keys(key),
  position integer NOT NULL DEFAULT 0, message_id text REFERENCES proto_messages(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  uploader_id text NOT NULL, uploader_kind text NOT NULL, name text NOT NULL, type text NOT NULL,
  size integer NOT NULL, width integer NOT NULL, height integer NOT NULL, data bytea NOT NULL,
  created_at timestamptz NOT NULL, expires_at timestamptz, extra jsonb
);
CREATE TABLE proto_credentials (
  id text PRIMARY KEY, owner_id text NOT NULL, name text NOT NULL,
  scopes text[] NOT NULL CHECK (scopes = ARRAY['comment']::text[]), hash bytea UNIQUE NOT NULL,
  created_at timestamptz NOT NULL, last_used_at timestamptz, revoked_at timestamptz
);
CREATE INDEX proto_messages_key ON proto_messages(key);
CREATE INDEX proto_events_key ON proto_events(key);
CREATE INDEX proto_attachments_key ON proto_attachments(key);
CREATE INDEX proto_credentials_owner ON proto_credentials(owner_id);
INSERT INTO proto_schema VALUES (1);
