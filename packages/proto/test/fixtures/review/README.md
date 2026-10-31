# Review fixture provenance

Stack v2 is copied from `apps/app/gallery/comments/proto-shell/comments.json`.
Reloaddev v1 files are copied from `~/Dev/courses/reloaddev/apps/platform/gallery/comments/`.
Only message bodies are anonymized. Structure, ids, timestamps, anchors and metadata are unchanged.
The available reloaddev files contain no attachments or fluxo- keys; synthetic edge cases in the
model suite exercise populated v1 attachments, localized flow keys, themes, roles and sources.

CompozyOS has no review files. Its fixture is produced by its real `canonicalFile` writer from
`~/Dev/compozy/compozy/web/gallery/shell/comments/model.ts` with sequence 9 and one deleted id.
