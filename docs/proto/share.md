# Share a local prototype

`proto share` gives invited colleagues a fixed HTTPS link to a built snapshot. Review comments and
approvals are stored immediately in the app's `proto/review/` files. The author sends the link;
Proto does not send invitations. Reviewers need only a browser and their mailbox.

## Connect once

1. Add a domain to Cloudflare.
2. Open Zero Trust in the dashboard and choose a team name. Its free plan covers up to 50 users;
   onboarding asks for payment details.
3. In **My Profile → API Tokens**, create a **user API token**. Grant account-level edit permissions
   for Cloudflare Tunnel, Access applications and policies, and Access identity providers. Grant
   **Zone → DNS → Edit** and **Zone → Zone → Read** for the chosen domain. The account permission
   labels are **Cloudflare Tunnel**, **Access: Apps and Policies**, and **Access: Organizations,
   Identity Providers, and Groups**; choose Edit. Scope the token to the intended account and zone.
4. Run `bun run proto share connect --domain example.com --app app` and paste the token at the hidden
   prompt. For automation, supply `CLOUDFLARE_API_TOKEN` in the process environment. Never put a token
   in arguments, a prototype, or committed configuration.

`--name team-review` creates `team-review.example.com` and `team-review-render.example.com`.
The default label is `proto-<git user>`. Repeating connect reuses the resources and restores the
required Access settings. The organization-wide email-code provider is kept on disconnect because
other applications may use it.

Credentials are outside the repository in `~/.config/compozy-proto/cloudflare.json` (0600, in a 0700
directory). A suitable `cloudflared` on PATH is used; otherwise Proto downloads and verifies its pinned
release in `~/.cache/compozy-proto/`.

## Share and refresh

```sh
bun run proto share login-form --approver ana@example.com --app app
bun run proto share --flow checkout --commenter bob@example.com --app app
bun run proto share --all --approver ana@example.com --commenter bob@example.com --app app
```

Choose exactly one target and at least one invitee. Both invitation flags repeat; email matching is
case insensitive, and approver wins if an email is listed twice. Use `--slug status` to share a
prototype whose name is also a subcommand. The link opens directly on the prototype or flow.

Approvers require a clean committed Git tree, checked across the whole workspace before and after
each build. Review history and temporary share outputs are excluded in code; no ignore rule is
required. Commenter-only sessions can share uncommitted work and print a notice that it is not
approvable. Nothing exposes the Vite development server or source tree.

Keep the command running. Press `r` to publish a new version, or use:

```sh
bun run proto share status --json
bun run proto share refresh --json
bun run proto share stop --json
bun run proto share disconnect --json
```

All commands accept `--app` and `--json`. Start prints exactly one JSON object when ready with
`link`, `target`, `invitees` (`email`, `role`), `snapshot`, and `commit`, then stays silent. Status returns
`running`, the start fields, `tunnel` (`starting`, `healthy` or `unhealthy`), and `startedAt`. During
startup, link/version fields may still be empty. Tunnel health queries have a five-second deadline and
do not retry; API errors, rate limits and timeouts report an unhealthy tunnel. Other API operations keep
their existing retry behavior. With no session it returns `{ "running": false }`.
Refresh returns `{ "snapshot": "…", "commit": "…" }`; stop returns
`{ "stopped": true }`. Refresh and stop work from another process through a bearer-protected loopback
control port. They do not require the caller's current directory to be the shared app.

Concurrent refresh requests share one build and reload the project configuration. A failed build keeps
the previous snapshot live. Once the snapshot is swapped, refresh succeeds and notifies reviewers;
a private session-record write failure produces a notice while status reports the live version.
Reviewers receive a new-version event and reload before approving; an approval from an older snapshot
is refused. The open gallery keeps showing the version it loaded and offers "A new version is
available" with Reload, which keeps the current screen (it asks first when a comment is unsent). It
also notices a missed event after its event stream reconnects, or when a frame fails to load a chunk
of the replaced version. When the review API stops answering and the bootstrap retry fails too, the
gallery shows "This session ended" with Reload, which leads to the Access login or its error page;
a passing network failure shows nothing. Agents can answer through `proto comments reply <id> --note "…"`; filesystem changes are
sent to reviewers over SSE. These commands are CLI-only; agents never approve reviews.

Ctrl+C removes invitations, ends the connector, closes both servers, removes temporary snapshots and
the private session file. A second Ctrl+C uses the runtime's default. An unexpected connector exit
performs the same cleanup and exits 4. If the Cloudflare API is unavailable at stop, Proto warns and
still closes the local tunnel. SIGKILL closes the sentinel's pipe and ends the connector; the next
start replaces the stale session and invitation policy.

## Review and isolation

Access emails the invited address a code. Its session lasts 24 hours. Approvers can comment and
approve; commenters can only comment. Identity is verified again at the local origin. Uninvited
emails see a denied page. Only the shared registry, render code, review keys and live events are
available. Reviewers cannot create agent credentials.

Shell and render use sibling subdomains with `allowSameSiteRender: true`. This is the explicit
same-site exception to the [deployment layout](deployment.md): same-origin checks and host-only
render grants isolate prototype code. Each share uses a fresh in-memory signing secret, so a grant
from one session cannot open the next. The link is printed only after the render host reaches this
process and the shell host redirects to Access.

Only one session per local user is allowed. A second machine may adopt the same Cloudflare setup,
but do not share from both simultaneously: connectors would split traffic. This is not detected
across machines. Sharing without Cloudflare, automatic live reload, and approving uncommitted work
are outside this feature.

## Errors

Failures with `--json` use `{ "error": { "code": "…", "message": "…" } }`.

| Code | Exit | Action |
| --- | --- | --- |
| `share_not_connected` | 4 | Run `proto share connect`. |
| `share_target_required` | 2 | Choose a slug, `--flow`, or `--all`. |
| `share_target_not_found` | 1 | Check the prototype slug or flow id. |
| `share_no_invitees` | 2 | Add `--approver` or `--commenter`. |
| `share_dirty_tree` | 1 | Commit first or use commenter-only invitations. |
| `share_session_running` | 1 | Use `status` and `stop` on the existing session. |
| `share_not_running` | 1 | Start a session before refreshing or stopping. |
| `share_hostname_taken` | 1 | Connect with another `--name`. |
| `share_connection_stale` | 4 | Reconnect; remove unexpected Access policies. |
| `share_tunnel_timeout` | 4 | The link did not answer within 30 seconds; check the network. |
| `share_tunnel_lost` | 4 | The connector stopped; restart the share. |
| `cloudflared_unavailable` | 3 | Install cloudflared and retry. |
| `cloudflare_token_invalid` | 4 | Replace the token or grant the missing permission. |
| `cloudflare_access_not_enabled` | 4 | Enable Zero Trust once in the dashboard. |
| `cloudflare_no_domain` | 4 | Add a domain to the account. |
| `cloudflare_api_error` | 4 | Check Cloudflare's reported error and retry. |
| `snapshot_stale` | HTTP 409 | Reload before approving the new version. |

## Live conformance before release

`test/node/share/live.test.ts` is opt-in with `PROTO_TEST_CLOUDFLARE_TOKEN`. Set
`PROTO_TEST_CLOUDFLARE_DOMAIN` when the token can see multiple zones; optionally set
`PROTO_TEST_CLOUDFLARE_APP`, `PROTO_TEST_CLOUDFLARE_SLUG`, and `PROTO_TEST_CLOUDFLARE_EMAIL`.
Use an isolated test account/zone. It provisions a unique label and removes its tunnel, DNS and Access
application; the organization email-code provider remains. A prebuilt shell is required.
`PROTO_TEST_CLOUDFLARE_JWT` optionally exercises SSE through the real proxy for over 150 seconds.
For that phase, prepare a stable test application with `PROTO_TEST_CLOUDFLARE_NAME`, log in to it,
and supply the unexpired value of its `CF_Authorization` cookie and matching invited email. The
suite sends that cookie to the Access edge; `Cf-Access-Jwt-Assertion` is the edge-to-origin header,
not a client login. The suite removes that test setup. When the variable is absent, the authenticated
SSE phase is skipped; manual login and expiry observations are still required.

Record these manual observations with a real email login: an uninvited address is refused; whether
`CF_Authorization` is sent to the sibling render host; what a shell fetch receives after temporarily
shortening the Access application's `session_duration`; what a new reviewer sees after stop; and how
application-scoped policy operations handle an attached reusable policy. Restore the application or
reconnect after these checks. These observations require Cloudflare and cannot be proved by the fake API.

The local suites cover the browser side without Cloudflare. `test/node/e2e/shell-review.test.ts`
runs a real share session behind the TLS harness of `test/node/server/harness.ts`, which maps the
shell and render hostnames to a local port and adds a signed Access assertion to shell requests
(E2E-001, E2E-004). `test/node/server/server.test.ts` proves that a same-site render iframe renders
with third-party cookies blocked in Chromium and in WebKit (E2E-003). Chromium maps the hostnames
with `--host-resolver-rules`; WebKit has no such flag, so it reaches them through Playwright's
`proxy` launch option and a local forward proxy that tunnels `CONNECT` to the harness. If WebKit
cannot run that way on a platform, check the rendered prototype in a real Safari during the live
run instead.
