# Security Policy

## Supported versions

`@compozy/proto` is experimental (0.x). Security fixes land on the latest published 0.x release
only.

## Reporting a vulnerability

Do not open a public issue. Report it privately through
[GitHub security advisories](https://github.com/compozy/proto/security/advisories/new) and include
the affected version, the steps to reproduce and the impact you observed.

You will get an acknowledgement within a few days. We will confirm the issue, prepare a fix and a
release, and credit you in the advisory unless you prefer otherwise.

## Scope

Reports we especially want to hear about:

- Prototype code (render origin) acting as a reviewer: writing comments, approving, or reading
  review credentials.
- Bypasses of the shell ⇄ render message validation, such as forged source paths reaching stored
  comments.
- Remote review server issues: authorization matrix bypasses, credential scope escalation, render
  ticket forgery, or `returnTo` open redirects.
- Path traversal in review storage, attachments or evidence output.
