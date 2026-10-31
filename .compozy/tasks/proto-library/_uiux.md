# UI/UX Change Map: @compozy/proto shell

Every surface of the review shell: what it is, which states it has, which stories it serves, and the
prototype state that is its visual contract. The visual contract is the draft prototype
`proto-shell` — today at `~/Dev/compozy/stack/apps/app/src/drafts/proto-shell/` (served by
`bun run proto dev --app app --port 4410`), migrating to `apps/app/src/drafts/proto-shell/` in this
repository in slice 1. "The proto prototyping the proto."

Companions: `_spec.md` Part I (behavior authority), `_user_stories.md` (states come from ACs/ECs), `_dx.md`
(URL contract and CLI).

## Design constraints (apply to every surface)

- **Visual language** (ADR-006): dark near-black canvas with a dotted grid, slightly lighter panels,
  hairline borders, pink primary (`oklch(0.74 0.19 352)` dark / `oklch(0.62 0.23 354)` light) used for
  the selected item, the active tool, open-comment counts, pins and the primary action; mono uppercase
  eyebrow labels for kinds (START · SCREEN · SAME SCREEN · REDIRECT · EXTERNAL · END) each with its own
  tone. Light theme is a first-class mirror. Reference: the workflow-canvas screenshot Pedro shared on
  2026-10-30 (lime → pink), reui-blocks `flow-2`, `flow-1`, `app-shell-1`, `whiteboard-1`.
- **Signal mapping**: pink = needs your attention (open comments, selection, primary); green = approved /
  covered; amber = warning (uncovered state, still loading); red = problem / render failure; neutral =
  everything else. Never decorative.
- **Truthful UI**: a preview that has not reported ready shows a skeleton, never a blank white box; a
  read-only build has no comment/approve controls at all; an unknown state in the URL renders the default
  state and marks the chip "unknown".
- **Prototype isolation**: previews keep the consumer's theme; they follow the shell theme only through
  `?theme=`.
- **Keyboard**: every action has a shortcut or is reachable by Tab; `?` lists them; focus-visible ring is
  the primary color.
- **Responsive**: ≥ 1536 full (meta in sub-header, legend in canvas); 1280 compact labels; 1024 inspector
  300 px; < 1024 inspector becomes a drawer (S20). Nothing wraps inside pills, chips or buttons.
- **Copy**: short, sentence case, no helper paragraphs under headings; `en` and `pt-BR` bundles.

## Surface map

| #   | Surface                                | Kind | Core change                                                           | Stories                  | Contract state(s) in `proto-shell` |
| --- | -------------------------------------- | ---- | --------------------------------------------------------------------- | ------------------------ | ---------------------------------- |
| S1  | Shell frame: rail, top bar, sub-header | new  | Icon rail areas, breadcrumbs, ⌘K field, open count, Share, Approve    | US-010–015, US-020       | all                                |
| S2  | Overview                               | new  | Spec cards with live previews and status, journeys, Needs review      | US-010                   | `overview`                         |
| S3  | Spec page                              | new  | Flows and screens of one spec, state counts, review status            | US-011                   | `spec`                             |
| S4  | Flow canvas                            | new  | Step cards, edges by kind, path highlight, zoom/minimap/stats         | US-012, US-008           | `flow`                             |
| S5  | Step inspector                         | new  | Preview, screen facts, arrives-from/leads-to, Open screen / Comment   | US-012                   | `flow`                             |
| S6  | Screen view                            | new  | State toolbar, viewport/theme/role controls, fitted frame             | US-013, US-006           | `screen`                           |
| S7  | Compare                                | new  | Light and dark side by side                                           | US-014                   | `compare`                          |
| S8  | Comment mode                           | new  | Crosshair picker, element/region highlight, composer with attachments | US-016, US-018           | `comment-compose`                  |
| S9  | Thread panel                           | new  | Open/Resolved tabs, threads with source chip, replies, Resolve/Reply  | US-019, US-017           | `screen`, `flow-comments`          |
| S10 | Approval                               | new  | Approve dialog with open-count warning, Approved status, Reopen       | US-020                   | `approve`, `approved`              |
| S11 | Comments inbox                         | new  | All comments across the app, filters, waiting-for-you                 | US-021                   | `inbox`                            |
| S12 | Drafts                                 | new  | Draft cards with badge and `proto new` hint                           | US-007                   | `drafts`                           |
| S13 | Search                                 | new  | ⌘K: prototypes, states, flows, comments, actions                      | US-015                   | `search`                           |
| S14 | Empty / first run                      | new  | No prototypes yet: `proto new` / docs                                 | US-002.EC-2, US-011.EC-1 | `empty`                            |
| S15 | Problems                               | new  | Top-bar problems badge + Health list with codes and files             | US-032, US-031           | `problems`                         |
| S16 | Render failure                         | new  | Error card inside the frame, component stack, reload                  | US-033                   | `render-error`                     |
| S17 | Settings                               | new  | Project (config read-only), Review (local/remote), Credentials, About | US-029, US-027           | `settings`                         |
| S18 | Remote sign-in                         | new  | Deployed gallery sign-in page                                         | US-028                   | `sign-in`                          |
| S19 | Shortcuts                              | new  | Shortcut sheet                                                        | US-015                   | `shortcuts`                        |
| S20 | Narrow layout                          | new  | Inspector as drawer below 1024 px                                     | —                        | `screen` at 900 px                 |
| S21 | Read-only build                        | new  | No comment/approve affordances, "Read-only" pill                      | US-003.AC-2              | `read-only`                        |

### S1. Shell frame

- **Change**: rail (Overview, Flows, Screens, Comments with dot when waiting, Drafts, Settings; app mark
  top, reviewer avatar bottom); top bar (breadcrumbs, ⌘K field that shrinks to an icon, open-count pill,
  problems badge when any, Share, Approve); sub-header (title, status pill, meta, Flow/Screens/Compare
  tabs, theme, history, more).
- **States**: in review · N open; approved; read-only (S21); problems > 0; narrow (S20).

### S2. Overview

- **States**: populated; with drafts group; unsorted group; zero specs (prototypes only by group);
  empty (S14); 100+ prototypes (lazy previews, 3 concurrent).

### S3. Spec page

- **Change**: header with spec title, status, counts; Flows row (journey cards with step count and
  uncovered warnings); Screens grid (card per prototype: preview of default state, state chips with open
  counts, surface + route).
- **States**: populated; approved; spec with no prototypes (empty card naming `spec: "<id>"`).

### S4. Flow canvas · S5. Step inspector

- **States**: nothing selected (inspector shows flow summary: description, steps, transitions, coverage);
  step selected; external step (no preview; service + URL); flow with problems (banner + outlined nodes);
  zoom below 60% (preview placeholders); uncovered-state warning chip.

### S6. Screen view · S7. Compare

- **States**: default; unknown state in URL; viewport presets + free width; role picker (when roles);
  preview loading (skeleton); render failure (S16).

### S8. Comment mode · S9. Thread panel

- **States**: picking (crosshair, hover outline, hint "Click an element or drag a region"); region
  drawn; composer open (with 0..6 attachment thumbnails, size error); sent (pin numbered); thread focused;
  reply composer; resolved tab; empty (no comments: "Press C…"); pin "moved" marker; deleted elsewhere.

### S10. Approval

- **States**: approve dialog (with "2 comments are still open" warning and confirm); approved (green pill,
  "Approved by Pedro · a41c9e2", Reopen in more menu); agent credential (Approve absent).

### S11. Comments inbox

- **States**: open list grouped by prototype/flow with filters (Open · Waiting for you · Resolved, author
  kind, spec); detail pane = thread + preview of the target state with the pin; empty ("No open
  comments").

### S12. Drafts

- **States**: draft cards; none (hint `proto new <slug> --draft`).

### S13. Search

- **States**: results grouped; no results.

### S14. Empty / first run

- **States**: no prototypes (steps: write `*.proto.tsx` or `proto new`, link to docs, live "Watching
  src/**/*.proto.tsx").

### S15. Problems

- **States**: badge in top bar with count; Health list (code, message, file:line, copy path); clean
  ("No problems").

### S16. Render failure

- **States**: error card (message, top component frames, "Reload state", "Copy error"); still loading
  after 10 s (amber, reload).

### S17. Settings

- **Sections**: Project (title, paths, specs, roles from config — read-only with "edit proto.config.ts");
  Review (mode local/remote, remote URL, signed-in reviewer); Credentials (list, create with scopes, token
  shown once, revoke); About (version, Vite, commit).

### S18. Remote sign-in

- **States**: sign-in card (app mark, "Sign in to review Acme prototypes", provider button / token
  field); session expired banner.

### S19. Shortcuts — sheet listing J/K, [ ], T, C, /, ⌘K, ?, Esc, F (fit), 1/2/3 (views).

### S20. Narrow layout — inspector hidden, a panel toggle in the sub-header opens it as a right drawer.

### S21. Read-only build — "Read-only" pill instead of open count; no Approve, no comment tool; threads

visible.

## Component plan (design → production mapping)

### Rules

- The shell vendors the BnUI components it uses into `packages/proto/src/shell/ui/` (generated copies with
  provenance, no import of the consumer's UI). Tokens live in `packages/proto/src/shell/theme.css`, the
  production form of the draft's `theme.css`.
- Domain composites in `packages/proto/src/shell/<area>/` named after the draft components:
  `ShellRail`, `ShellTopBar`, `ShellSubHeader`, `StatusPill`, `Inspector`, `StepPanel`, `CommentsPanel`,
  `CommentCard`, `FlowCanvas` (`StepCard`, `LinkLine`), `ScreenCanvas` (`CanvasToolbar`), `CompareCanvas`,
  `Overview`, `SearchPalette`, `LivePreview`/`FitPreview`.

### New primitives

- `FitPreview` — iframe preview scaled to its container (width or contain), with overlay slot; no BnUI
  equivalent.
- `Pin` — numbered comment pin with anchor corner; no BnUI equivalent.

### Signal & state mapping

| Signal                          | Primitive + token                                                         |
| ------------------------------- | ------------------------------------------------------------------------- |
| Open count / in review          | `StatusPill` · `--shell-primary-soft` bg, `--primary` text                |
| Approved                        | `StatusPill` · `--tone-end` 16% bg, `--tone-end` text                     |
| Uncovered state / still loading | inline chip · `--tone-warning` 12% bg                                     |
| Problem / render error          | `Badge destructive-light` · `--destructive`                               |
| Selected step / active tool     | border `--primary` + `--shell-primary-soft` ring                          |
| Kind eyebrows                   | mono 10px uppercase · `--tone-start/screen/overlay/redirect/external/end` |
