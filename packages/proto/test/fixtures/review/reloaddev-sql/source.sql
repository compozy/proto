-- Anonymized schema/data fixture; provenance in README.md. No credential is usable.
CREATE TABLE waitlist_signups (id uuid PRIMARY KEY);
CREATE TABLE "user" (
 id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE,
 email_verified boolean NOT NULL DEFAULT false, image text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'pending', status_version integer NOT NULL DEFAULT 0,
 role text NOT NULL DEFAULT 'member', theme text NOT NULL DEFAULT 'system',
 waitlist_signup_id uuid REFERENCES waitlist_signups(id) ON DELETE SET NULL, approved_at timestamptz
);
CREATE TABLE prototype_reviews (slug text PRIMARY KEY,next_comment integer NOT NULL DEFAULT 1,approved_by text REFERENCES "user"(id) ON DELETE SET NULL,approved_at timestamptz);
CREATE TABLE prototype_comments (id text PRIMARY KEY,slug text NOT NULL REFERENCES prototype_reviews(slug),status text NOT NULL DEFAULT 'open',context jsonb NOT NULL,target jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),resolved_at timestamptz);
CREATE INDEX prototype_comments_slug_idx ON prototype_comments(slug);
CREATE TABLE prototype_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),comment_id text NOT NULL REFERENCES prototype_comments(id) ON DELETE CASCADE,author_id text REFERENCES "user"(id) ON DELETE SET NULL,author text NOT NULL,body text NOT NULL,at timestamptz NOT NULL DEFAULT now(),edited_at timestamptz);
CREATE INDEX prototype_messages_comment_idx ON prototype_messages(comment_id,at);
CREATE TABLE prototype_credentials (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,token_hash text NOT NULL UNIQUE,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE prototype_attachments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),message_id uuid REFERENCES prototype_messages(id) ON DELETE CASCADE,uploader_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,name text NOT NULL,type text NOT NULL,size integer NOT NULL,width integer NOT NULL,height integer NOT NULL,bytes bytea NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX prototype_attachments_message_idx ON prototype_attachments(message_id);
CREATE INDEX prototype_attachments_pending_idx ON prototype_attachments(created_at);
INSERT INTO "user" (id,name,email,status,role) VALUES ('u-reviewer','Fixture Reviewer','reviewer@example.test','active','admin'),('u-agent','Fixture Agent Owner','agent@example.test','active','member');
INSERT INTO prototype_reviews VALUES ('fluxo-cadastro',8,'u-reviewer','2026-10-01T10:00:00Z'),('login-form',4,null,null);
INSERT INTO prototype_comments (id,slug,status,context,target,created_at,updated_at) VALUES
 ('fluxo-cadastro-7','fluxo-cadastro','open','{"state":"default","theme":"escuro","role":"membro","viewport":{"width":1280,"height":800},"custom":"preserve"}','{"kind":"node","node":"inicio","label":"Start"}','2026-09-30T10:00:00Z','2026-09-30T11:00:00Z'),
 ('login-form-1','login-form','open','{"state":"default","theme":"claro","role":null,"viewport":{"width":1280,"height":800}}','{"kind":"node","node":null,"label":"Login"}','2026-09-30T10:00:00Z','2026-09-30T11:00:00Z');
INSERT INTO prototype_messages VALUES
 ('10000000-0000-4000-8000-000000000001','fluxo-cadastro-7','u-reviewer','reviewer','Anonymized review.','2026-09-30T10:00:00Z',null),
 ('10000000-0000-4000-8000-000000000002','fluxo-cadastro-7','u-agent','agent','Anonymized reply.','2026-09-30T11:00:00Z',null),
 ('10000000-0000-4000-8000-000000000003','login-form-1','u-reviewer','reviewer','Anonymized login review.','2026-09-30T10:00:00Z',null);
INSERT INTO prototype_credentials VALUES ('20000000-0000-4000-8000-000000000001','u-agent','fixture-not-a-real-hash','2026-09-30T10:00:00Z');
INSERT INTO prototype_attachments VALUES ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','u-reviewer','pixel.png','image/png',68,1,1,decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=','base64'),'2026-09-30T10:00:00Z');
