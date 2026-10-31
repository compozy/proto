/**
 * Runtime bootstrap (`_spec.md` § Data Models — Bootstrap): `GET /__proto/bootstrap.json`, served
 * by the dev shell server, written by `proto build` and answered by the remote server. The
 * prebuilt shell reads it first; it is the only way the shell learns its environment (no
 * compile-time `import.meta.env`, no Vite HMR client). URLs may be relative to the document so
 * a static build works under any subpath.
 */

import { z } from "zod";

export const principalSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["reviewer", "agent"]),
  scopes: z.array(z.enum(["review", "comment"])),
  credentialId: z.string().nullable(),
});
export type BootstrapPrincipal = z.infer<typeof principalSchema>;

export const bootstrapSchema = z.object({
  mode: z.enum(["dev", "read-only", "remote"]),
  title: z.string(),
  locale: z.enum(["en", "pt-BR"]),
  /** Full 40-hex SHA of the served checkout or build, null outside git. */
  commit: z.string().nullable(),
  /** Base of the review API (`/__proto/api/` in dev, `<basePath>api/` remotely); null read-only. */
  apiBase: z.string().nullable(),
  /** SSE endpoint (`registry`, `comments`, `review` events); null in read-only builds. */
  eventsUrl: z.string().nullable(),
  /**
   * Render host base; its origin (resolved against the document) is the only origin the shell
   * accepts render messages from. Dev and remote: `…/__proto/render/` — path form, append
   * `<slug>?state=…`. Read-only static build: `__proto/render/index.html` — query form,
   * `?slug=<slug>&state=…` (`renderHref` in `protocol.ts` builds both).
   */
  renderUrl: z.string(),
  /** Where the shell reads the registry snapshot (`GET registry` or `registry.json`). */
  registryUrl: z.string(),
  /** Read-only builds with `build.includeReview`: base of `review/<key>.json`; else null. */
  reviewSnapshotBase: z.string().nullable(),
  principal: principalSchema.nullable(),
  signInUrl: z.string().nullable(),
});
export type Bootstrap = z.infer<typeof bootstrapSchema>;

export const bootstrapPath = "/__proto/bootstrap.json";
