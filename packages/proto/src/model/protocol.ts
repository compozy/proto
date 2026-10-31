/**
 * Shell ⇄ render protocol, version 1 (`_spec.md` § Shell ⇄ render protocol, ADR-008).
 *
 * Every message is `{ proto: 1, frame: <nonce>, type, … }`. The shell accepts a message only when
 * `event.source` is the iframe it created with that nonce and `event.origin` is the render
 * origin; the render host accepts only from `window.parent` whose origin equals the shell origin
 * of its own configuration. Render → shell messages are untrusted input (the prototype shares the
 * render host's realm): the shell parses every payload with these schemas, accepts `pick:result`
 * only during a pick it started, and confines `context.url` and source paths (`source.ts`).
 * Pure: no Node, no DOM.
 */

import { z } from "zod";

export const protocolVersion = 1;

const rect = z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() });
export type Rect = z.infer<typeof rect>;

/** What a pick returns: the v2 `ElementTarget` shape, unchanged field names. */
export const elementTargetSchema = z.object({
  kind: z.enum(["element", "region"]),
  selector: z.string().max(2000),
  testId: z.string().max(500).nullable(),
  tag: z.string().max(100),
  text: z.string().max(120),
  source: z.string().max(1000).nullable(),
  sourceChain: z.array(z.string().max(1000)).max(8),
  rect,
  rectNormalized: rect,
  offset: rect.nullable(),
});
export type ElementTarget = z.infer<typeof elementTargetSchema>;

const envelope = { proto: z.literal(protocolVersion), frame: z.string().min(1).max(200) };

export const pickModeSchema = z.enum(["element", "region", "keyboard"]);
export type PickMode = z.infer<typeof pickModeSchema>;

export const anchorSchema = z.object({
  id: z.string(),
  selector: z.string(),
  testId: z.string().nullable(),
  offset: rect.nullable(),
});
export type Anchor = z.infer<typeof anchorSchema>;

/** Render → shell. */
export const renderMessageSchema = z.discriminatedUnion("type", [
  z.object({ ...envelope, type: z.literal("ready"), slug: z.string(), state: z.string() }),
  z.object({
    ...envelope,
    type: z.literal("error"),
    message: z.string().max(4000),
    componentStack: z.string().max(20000).nullable(),
  }),
  z.object({
    ...envelope,
    type: z.literal("context"),
    state: z.string(),
    theme: z.enum(["light", "dark"]),
    role: z.string().nullable(),
    url: z.string().max(4000),
  }),
  z.object({ ...envelope, type: z.literal("pick:result"), target: elementTargetSchema }),
  z.object({
    ...envelope,
    type: z.literal("anchors"),
    rects: z.array(z.object({ id: z.string(), rect: rect.nullable() })).max(500),
  }),
  z.object({ ...envelope, type: z.literal("auth:expired") }),
]);
export type RenderMessage = z.infer<typeof renderMessageSchema>;

/** Shell → render. */
export const shellMessageSchema = z.discriminatedUnion("type", [
  z.object({ ...envelope, type: z.literal("pick:start"), mode: pickModeSchema }),
  z.object({ ...envelope, type: z.literal("pick:cancel") }),
  z.object({ ...envelope, type: z.literal("anchors:watch"), anchors: z.array(anchorSchema) }),
  z.object({ ...envelope, type: z.literal("scroll:to"), selector: z.string() }),
]);
export type ShellMessage = z.infer<typeof shellMessageSchema>;

/** Query parameters of a render URL. `frame` carries the nonce; `chrome=0` drops the toolbar. */
export type RenderParams = {
  slug: string;
  state?: string;
  theme?: "light" | "dark";
  role?: string | null;
  w?: number;
  frame?: string;
  chrome?: 0;
};

/**
 * Builds a render URL from bootstrap `renderUrl`: path form `…/__proto/render/<slug>?state=…`
 * (dev, remote) or query form `…/index.html?slug=<slug>&state=…` (static read-only build).
 */
export function renderHref(renderUrl: string, params: RenderParams) {
  const query = new URLSearchParams();
  const queryForm = renderUrl.endsWith(".html");
  if (queryForm) query.set("slug", params.slug);
  if (params.state) query.set("state", params.state);
  if (params.theme) query.set("theme", params.theme);
  if (params.role) query.set("role", params.role);
  if (params.w) query.set("w", String(params.w));
  if (params.frame) query.set("frame", params.frame);
  if (params.chrome === 0) query.set("chrome", "0");
  const search = query.toString();
  const base = queryForm ? renderUrl : `${renderUrl.replace(/\/?$/, "/")}${params.slug}`;
  return `${base}${search ? `?${search}` : ""}`;
}

/**
 * Reads a `context.url` from the render host: accepted only as `/__proto/render/<known slug>?…`
 * or the static `…/__proto/render/index.html?slug=<known slug>&…` form; only `state`, `theme`,
 * `role` and `w` are kept. Anything else returns null and is ignored.
 */
export function readContextUrl(url: string, knownSlugs: ReadonlySet<string>) {
  let parsed: URL;
  try {
    parsed = new URL(url, "http://render.invalid");
  } catch {
    return null;
  }
  const path = parsed.pathname;
  const match = /\/__proto\/render\/([^/]+)$/.exec(path);
  const slug = match?.[1] === "index.html" ? parsed.searchParams.get("slug") : (match?.[1] ?? null);
  if (!slug || !knownSlugs.has(slug)) return null;
  const width = Number(parsed.searchParams.get("w"));
  const theme = parsed.searchParams.get("theme");
  return {
    slug,
    state: parsed.searchParams.get("state"),
    theme: theme === "light" || theme === "dark" ? theme : null,
    role: parsed.searchParams.get("role"),
    w: Number.isFinite(width) && width > 0 ? width : null,
  };
}
