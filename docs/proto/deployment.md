# Remote review deployment

Configure `review.remote.url` in the app's `proto.config.ts` with the public gallery
URL, including `/proto/`, then run `bun run proto build --remote --app app`. This is a remote
build: the boolean `--remote` selects `PROTO_REMOTE_URL` or the configured URL. The iframe uses path URLs and trusts only that URL's origin. Rebuild to change it.
Plain `proto build` remains read-only even when a remote URL is configured. Node callers use
`buildProject(project, { remote: publicOrigin })`.
Set `PROTO_GALLERY_DIR` to the absolute `apps/app/dist-proto` path. The API serves
that output, replaces bootstrap data with the current session, and serves render assets
only after exchanging a short-lived ticket for a host-only grant.

Use HTTPS for both origins (HTTP is allowed only on literal loopback). Put render on
a different registrable domain, forward the original Host, and leave the review cookies
host-only. The shell cannot be framed; render documents can only be framed by the
configured public origin. Browser integration tests use `gallery.example.com` and
`render.example.net` resolved to loopback through Chromium, with local TLS certificates,
so they exercise real cross-site cookie rules rather than treating loopback IPs as sites.

The API template grants review/comment scopes only to verified Better Auth users in
`PROTO_REVIEW_EMAILS`. Follow [operator provisioning](../../apps/api/src/platform/proto.md)
to verify a reviewer when no email sender is configured. The login callback retains only
origin-relative `/proto/` documents. An expired API session starts again at the gallery;
the shell substitutes the current document in its sign-in link.

Local dev `allowedHosts` entries are hostnames without ports; `host:port` entries fail
configuration validation with an explanation. Each server checks its
own port, and the allowlist never changes the canonical origin required for writes or
render protocol messages. Use `proto dev --open` to open the canonical shell.
