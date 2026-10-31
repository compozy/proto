/**
 * The gallery view lives in its URL, so a link reopens the same screen at every level: `/` (specs
 * index), `/?spec=auth`, `/?p=login` (page), `/?p=login&state=error&theme=dark&role=admin&w=390&
 * compare=themes&comments=1` (state), or a flow: `/?flow=sign-in&node=form&comments=1`. `spec`,
 * `p` and `flow` are exclusive: every gallery link goes through `selectionHref`/`select`, which
 * drop the other selection's parameters. `theme`, `state` and `role` keep the values of the
 * standalone prototype URL (`/<slug>?chrome=0&theme=…&state=…&role=…`), which the canvas iframe
 * loads.
 */
import { setParams, useSearch, type PrototypeMeta } from "../contract";

export type Viewport = "fit" | number;

export type Device = "desktop" | "tablet" | "phone";

/**
 * Viewport presets by device; the first width of each is the device's default. Any width from
 * `minWidth` to `maxWidth` is valid in `?w=` (the canvas handles drag to custom widths).
 */
export const devices: {
  id: Device;
  label: string;
  widths: readonly { width: number; label: string }[];
}[] = [
  {
    id: "desktop",
    label: "Desktop",
    widths: [
      { width: 1440, label: "Large laptop" },
      { width: 1920, label: "Full HD monitor" },
      { width: 1280, label: "Laptop" },
    ],
  },
  {
    id: "tablet",
    label: "Tablet",
    widths: [
      { width: 834, label: "iPad Air" },
      { width: 1024, label: "iPad Pro" },
      { width: 768, label: "iPad mini" },
    ],
  },
  {
    id: "phone",
    label: "Phone",
    widths: [
      { width: 390, label: "iPhone" },
      { width: 430, label: "iPhone Pro Max" },
      { width: 360, label: "Compact Android" },
    ],
  },
];

/** The device a width belongs to (phones below 600 px, tablets below 1180 px); none for "fit". */
export function deviceOf(width: Viewport): Device | null {
  if (width === "fit") return null;
  if (width < 600) return "phone";
  return width < 1180 ? "tablet" : "desktop";
}

/** Role id → label, from the app's `gallery.config.ts`. */
export type RoleLabels = Readonly<Record<string, string>>;

/** Picker options: the prototype's declared roles, else every configured role plus the default. */
export function roleOptionsFor(roles: PrototypeMeta["roles"], labels: RoleLabels) {
  if (roles) return roles.map(role => ({ value: role, label: labels[role] ?? role }));
  const all = Object.entries(labels).map(([value, label]) => ({ value, label }));
  return all.length ? [{ value: "", label: "Default role" }, ...all] : [];
}

/** Explicit supported roles win; without declared roles a prototype picks its own default. */
export function resolvePrototypeRole(
  requested: string | null,
  declared: PrototypeMeta["roles"],
  labels: RoleLabels
): string | null {
  const supported: readonly string[] = declared ?? Object.keys(labels);
  return supported.find(role => role === requested) ?? declared?.[0] ?? null;
}

export type GalleryView = {
  /** Spec overview (`?spec=`); with no selection at all the gallery shows the specs index. */
  spec: string | null;
  slug: string | null;
  state: string | null;
  theme: "light" | "dark" | null;
  role: string | null;
  width: Viewport;
  compare: boolean;
  panel: boolean;
  /** Comment to focus, from a CLI or copied link. */
  comment: string | null;
  /** Flow on screen (`?flow=`) and its selected node (`?node=`). */
  flow: string | null;
  node: string | null;
};

export const minWidth = 320;
export const maxWidth = 3840;

function widthOf(value: string | null): Viewport {
  const width = Number(value);
  return Number.isInteger(width) && width >= minWidth && width <= maxWidth ? width : "fit";
}

export function readView(search: string): GalleryView {
  const params = new URLSearchParams(search);
  const theme = params.get("theme");
  return {
    spec: params.get("spec"),
    slug: params.get("p"),
    state: params.get("state"),
    theme: theme === "light" || theme === "dark" ? theme : null,
    role: params.get("role"),
    width: widthOf(params.get("w")),
    compare: params.get("compare") === "themes",
    panel: params.get("comments") === "1" || params.has("comment"),
    comment: params.get("comment"),
    flow: params.get("flow"),
    node: params.get("node"),
  };
}

type ViewParams = Partial<Omit<GalleryView, "spec" | "slug" | "flow">>;

function paramsOf(view: ViewParams): Record<string, string | null> {
  const values: Record<string, string | null> = {};
  if ("state" in view) values.state = view.state ?? null;
  if ("theme" in view) values.theme = view.theme ?? null;
  if ("role" in view) values.role = view.role ?? null;
  if ("width" in view) values.w = view.width === "fit" || !view.width ? null : String(view.width);
  if ("compare" in view) values.compare = view.compare ? "themes" : null;
  if ("panel" in view) values.comments = view.panel ? "1" : null;
  if ("comment" in view) values.comment = view.comment ?? null;
  if ("node" in view) values.node = view.node ?? null;
  return values;
}

/** Changes parameters inside the current selection (state, theme, node…); never adds history. */
export function updateView(patch: ViewParams) {
  setParams(paramsOf(patch));
}

/**
 * What a gallery link opens, one per navigation level: the specs index, a spec, a page
 * (prototype, first state) or one of its states, and a flow (or one of its steps).
 */
export type Selection =
  | { kind: "index" }
  | { kind: "spec"; spec: string }
  | { kind: "prototype"; slug: string; state?: string | null; role?: string | null }
  | { kind: "flow"; flow: string; node?: string | null };

/** Every gallery parameter except `theme`, which all selections share. */
const galleryParams = [
  "spec",
  "p",
  "state",
  "role",
  "w",
  "compare",
  "comments",
  "comment",
  "flow",
  "node",
] as const;

/** Parameters each selection keeps; the others are cleared (the theme is always kept). */
const keptParams: Record<Selection["kind"], ReadonlySet<string>> = {
  index: new Set(),
  spec: new Set(["spec"]),
  prototype: new Set(["p", "state", "role", "w", "compare", "comments", "comment"]),
  flow: new Set(["flow", "node", "comments", "comment"]),
};

function selectionParams(selection: Selection): Record<string, string | null> {
  const kept = keptParams[selection.kind];
  const values: Record<string, string | null> = Object.fromEntries(
    galleryParams.filter(name => !kept.has(name)).map(name => [name, null])
  );
  if (selection.kind === "spec") values.spec = selection.spec;
  if (selection.kind === "flow") {
    values.flow = selection.flow;
    values.node = selection.node ?? null;
    values.comment = null;
  }
  if (selection.kind === "prototype") {
    values.p = selection.slug;
    values.state = selection.state ?? null;
    values.comment = null;
    if (selection.role !== undefined) values.role = selection.role || null;
  }
  return values;
}

/**
 * Href for a selection: it sets its own parameters and clears every other selection's, keeping
 * `theme` (and, for prototypes, role, viewport and the comments panel; for flows, the comments
 * panel). Every gallery link uses it, so a modified click (new tab) lands on the same URL as a
 * plain click.
 */
export function selectionHref(selection: Selection, search = window.location.search) {
  const params = new URLSearchParams(search);
  for (const [name, value] of Object.entries(selectionParams(selection))) {
    if (value === null) params.delete(name);
    else params.set(name, value);
  }
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

/**
 * `selectionHref` bound to the current URL as React state, so memoized rows rebuild their links
 * when kept parameters (`theme`, `role`, `w`…) change.
 */
export function useSelectionHref() {
  const search = useSearch();
  return (selection: Selection) => selectionHref(selection, search);
}

/** Plain click navigates in place; modified clicks keep the link's default (new tab). */
export function plainClick(event: {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  button: number;
  preventDefault: () => void;
}) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
    return false;
  }
  event.preventDefault();
  return true;
}

/** Same rules as `selectionHref`, adding a history entry (Back returns to the previous view). */
export function select(selection: Selection) {
  setParams(selectionParams(selection), { push: true });
}

/** Absolute link to a selection, for the "copy link" menu. */
export function selectionUrl(selection: Selection, search = window.location.search) {
  return new URL(selectionHref(selection, search), window.location.href).href;
}

type FlowLike = { id: string; nodes: readonly { id: string }[] };

type Catalog<Flow extends FlowLike> = {
  flows: readonly Flow[];
  prototypeExists: (slug: string) => boolean;
  specExists: (spec: string) => boolean;
};

export type ResolvedSelection<Flow extends FlowLike> =
  | { kind: "flow"; flow: Flow; node: string | null }
  | { kind: "missing-flow"; id: string }
  | { kind: "prototype"; slug: string }
  | { kind: "spec"; spec: string }
  | { kind: "index" };

export type ResolvedKind = ResolvedSelection<FlowLike>["kind"];

/**
 * What the URL selects. An existing `flow` wins over `p`, which wins over `spec`; a missing flow
 * shows "Flow not found" unless `p` names an existing prototype, which then wins. An unknown `p`
 * or `spec` falls back to the next level up (the spec, then the index). A stale `node` selects
 * nothing.
 */
export function resolveSelection<Flow extends FlowLike>(
  view: GalleryView,
  catalog: Catalog<Flow>
): ResolvedSelection<Flow> {
  const prototype = view.slug && catalog.prototypeExists(view.slug) ? view.slug : null;
  if (view.flow) {
    const flow = catalog.flows.find(item => item.id === view.flow);
    if (flow) {
      const node = flow.nodes.some(item => item.id === view.node) ? view.node : null;
      return { kind: "flow", flow, node };
    }
    if (!prototype) return { kind: "missing-flow", id: view.flow };
  }
  if (prototype) return { kind: "prototype", slug: prototype };
  if (view.spec && catalog.specExists(view.spec)) return { kind: "spec", spec: view.spec };
  return { kind: "index" };
}

/**
 * Parameters to rewrite (without history) so the URL names only what is on screen. Reads the raw
 * query: a present parameter is cleared whether or not its value is valid or empty. A missing
 * flow keeps its URL, so the notice can name it.
 */
export function canonicalParams<Flow extends FlowLike>(
  search: string,
  resolved: ResolvedSelection<Flow>
): Record<string, string | null> | null {
  if (resolved.kind === "missing-flow") return null;
  const params = new URLSearchParams(search);
  const kept = keptParams[resolved.kind];
  const patch: Record<string, string | null> = {};
  for (const name of galleryParams) {
    if (params.has(name) && !kept.has(name)) patch[name] = null;
  }
  if (resolved.kind === "flow" && params.has("node") && resolved.node === null) patch.node = null;
  return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * The standalone prototype URL the canvas loads (also the `proto evidence` contract); with
 * `toolbar`, the floating prototype toolbar stays (for "open in a new tab").
 */
export function frameSrc(
  slug: string,
  view: { state: string; theme: string | null; role: string | null },
  toolbar = false
) {
  const params = new URLSearchParams(toolbar ? {} : { chrome: "0" });
  if (view.theme) params.set("theme", view.theme);
  if (view.state) params.set("state", view.state);
  if (view.role) params.set("role", view.role);
  const query = params.toString();
  return `/${slug}${query ? `?${query}` : ""}`;
}
