# Story host integration fixture

`app` and `packages/ui` are separate Vite roots. The canonical dev-server suite copies both into
an isolated directory and gives each its own dependency links and optimizer cache. The app's
public directory receives MSW's real worker from the installed package during fixture setup.
Storybook and React are real peers; no Storybook main configuration or builder runs.

`preview.tsx` exercises project annotations, a project loader, MSW and the theme hook. Button
stories exercise interactions, network loaders, no-play thumbnails, render/load/play errors and
deadlines. Badge verifies that the second root has its own preview. Every frame gets one document;
replay and source edits reload it. The internal batch driver reads `html.dataset.protoStory`.

These suites are written for CI. The S1 implementation dispatch explicitly prohibits local tests,
servers, lint, typecheck and builds on the operator's overloaded machine.

The roots also mount distinct `assets` directories at `/vendor`. The dev suite covers native
add/change/unlink discovery, document reload and syntax recovery, custom theme globals, pinned
stories, and startup rollback. The guard suite exercises transitive runtime imports, erased type
imports and root policy isolation. Local router/store tests own story review persistence and
lossless orphan history; the remote suites keep story comments unavailable.
