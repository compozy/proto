# @proto/ui

The BnUI library (BN Tecnologia), vendored from `reui-blocks` at commit `646b796` (2026-10-22):

- `src/components/*.tsx`: shadcn Base Nova primitives on Base UI (MIT, `LICENSES/shadcn-MIT.txt`)
  and the BnUI modules from ReUI (MIT, `LICENSES/reui-MIT.txt`). Multi-file modules keep their
  folder (`data-grid/`, `filters/`, `cascader/`, `event-calendar/`, `gantt/`, `code-block/`).
  Where both sources ship a name (`alert`, `badge`), the BnUI module is the one kept.
- `src/hooks/*`, `src/lib/utils.ts`, `src/lib/icons.ts` (Reicon behind Lucide names: import
  icons from `@proto/ui/lib/icons`, never `lucide-react`).
- `src/styles/contract.css`: the BnUI stylesheet contract (Tailwind, state variants, `defaults:`
  layer, token mapping). `src/styles/theme.css`: the neutral default theme; replace its values
  with the project brand.

Keep vendored files as they are; update them from the `@bnui` registry (`components.json`,
`BNUI_TOKEN`) with `bunx shadcn add @bnui/<name>` from this folder, then rewrite `@/…` imports
to `@proto/ui/…`.
