# Prototype review deployment

Set `PROTO_PUBLIC_ORIGIN`, `PROTO_RENDER_ORIGIN`, `PROTO_TICKET_SECRET` (at least 32 bytes),
`PROTO_GALLERY_DIR`, and `PROTO_REVIEW_EMAILS` in the deployment environment. Empty origins
or secret disable review hosting; an empty email allowlist denies all identities. The
allowlist is comma-separated and case-insensitive. Allowed Better Auth accounts with `emailVerified === true` get both
`review` and `comment`; bearer owners are reloaded from the database on every request.

Serve the SPA login and API under the intended public deployment. The review handler mounts
at `/proto/*`; all paths on the configured render host dispatch to it before application
middleware. Forward the real Host, never rewrite it to a different authority. Use HTTPS and
a different registrable domain for render. Better Auth cookies remain host-only and HttpOnly,
and production enables Secure cookies. No cross-subdomain cookie sharing is configured.

Startup applies the package's PostgreSQL DDL before serving. It uses the app's SQL connection,
with `proto_*` tables isolated from Better Auth tables. Render requests never call Better Auth.
The sign-in handoff sends `returnTo` to the SPA login; the login route accepts only `/proto/`
paths and returns to the configured API origin after authentication.

The Proto fetch handler has its own documented protocol and error registry, so its wildcard
routes intentionally use `app.all` rather than OpenAPI `createRoute`. Application `/v1` routes
remain OpenAPI routes. No generated OpenAPI files change. The one production-boundary lint
exception is the explicit `@compozy/proto/server` adapter import; preview UI remains forbidden.

Build the gallery for this deployment by setting `review.remote.url` to
`https://gallery.example.com/proto/` in `apps/app/proto.config.ts`, then run
`bun run proto build --app app`. Set `PROTO_GALLERY_DIR` to the absolute resulting
`apps/app/dist-proto` directory. The build embeds the public origin in the render
protocol; rebuild when that origin changes. A local read-only build is not a remote build.

This template has no email sender. An operator must verify a person's ownership of the
allowlisted address through a trusted channel before provisioning review access. After
that check, use a parameterized one-off database script (never expose an HTTP endpoint):

```ts
await sql`update "user" set email_verified = true where id = ${verifiedUserId}`;
```

Use the independently confirmed user id, not an email supplied by an unverified signup.
Removing verification or the allowlist entry revokes session review access and invalidates
that owner's bearer credentials on their next request. Existing sessions need no new token.
