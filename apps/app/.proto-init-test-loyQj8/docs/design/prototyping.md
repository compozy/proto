---
target: library
host: vite-app
prototypes: src/drafts
entry: "{slug}/index.proto.tsx"
providers: proto.canvas.tsx
dev: proto dev
preview: "http://127.0.0.1:4401/__proto/render/{slug}?chrome=0"
evidence: "proto evidence {slug} --state <id>"
output: "docs/design/{slug}/"
---

# Prototyping

Compose views in component prototypes; drafts may use markup. Run proto check before review.
