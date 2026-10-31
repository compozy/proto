# Reloaddev SQL fixture

Schema transcribed on 2026-10-31 from
`~/Dev/courses/reloaddev/packages/db/src/schema/prototypes.ts` and its `schema/auth.ts`
user table. It preserves the prototype tables' columns, defaults, relationships and indexes.
The referenced waitlist table is represented by its UUID primary key; unrelated auth tables and
user lookup indexes (including the pg_trgm index) are omitted because the migration never uses them.
Rows are synthetic/anonymized, not a production database export. Bodies, names, emails and the
unusable legacy credential hash are invented. The PNG is the existing one-pixel test image.

The fixture includes a retired sequence, an approved `fluxo-` key with an open comment,
`claro`/`escuro`, `membro`, both author kinds, a claimed image and an unknown context field.
No source account credentials or live secrets are included.
