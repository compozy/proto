/**
 * The shell view lives in its URL (`_dx.md` § URLs, shell origin), so a shared link reopens
 * exactly what the sender saw. Values are locale-independent (`theme=dark`, never `escuro`).
 * Precedence when parameters conflict: `flow` > `p` > `spec` > the area parameters; the
 * losers are dropped from the canonical URL. Pure: no DOM.
 */

export const minWidth = 320;
export const maxWidth = 3840;

/** Viewport presets (`_spec.md` § Business Rules — Viewport); `fit` follows the canvas. */
export const presets = [
  { id: "desktop", width: 1440 },
  { id: "tablet", width: 834 },
  { id: "phone", width: 390 },
] as const;
export type Preset = (typeof presets)[number]["id"];

export type Width = number | "fit";
export type ThemeChoice = "light" | "dark" | "system";
export const settingsSections = ["project", "review", "credentials", "health", "about"] as const;
export type SettingsSection = (typeof settingsSections)[number];
export type InboxFilter = "open" | "waiting" | "resolved";

export type View =
  | { area: "overview" }
  | { area: "spec"; spec: string }
  | { area: "flows" }
  | { area: "flow"; flow: string; node: string | null }
  | { area: "screens" }
  | {
      area: "screen";
      slug: string;
      state: string | null;
      width: Width;
      role: string | null;
      compare: boolean;
      /** A comment to focus (`?comment=login-form-7`), consumed by the review slice. */
      comment: string | null;
    }
  | { area: "drafts" }
  | { area: "settings"; section: SettingsSection }
  | { area: "comments"; filter: InboxFilter };

export type Location = { view: View; theme: ThemeChoice };

export function clampWidth(width: number) {
  return Math.min(maxWidth, Math.max(minWidth, Math.round(width)));
}

function readWidth(value: string | null): Width {
  if (value === null || value === "" || value === "fit") return "fit";
  const width = Number(value);
  return Number.isFinite(width) ? clampWidth(width) : "fit";
}

function readTheme(value: string | null): ThemeChoice {
  return value === "light" || value === "dark" ? value : "system";
}

/** Parses a shell search string; `canonical` is the search to rewrite the URL to. */
export function parseView(search: string): Location & { canonical: string } {
  const params = new URLSearchParams(search);
  const theme = readTheme(params.get("theme"));
  const view = readArea(params);
  const location = { view, theme };
  return { ...location, canonical: viewSearch(location) };
}

function readArea(params: URLSearchParams): View {
  const flow = params.get("flow");
  if (flow) return { area: "flow", flow, node: params.get("node") || null };
  const slug = params.get("p");
  if (slug) {
    return {
      area: "screen",
      slug,
      state: params.get("state") || null,
      width: readWidth(params.get("w")),
      role: params.get("role") || null,
      compare: params.get("compare") === "themes",
      comment: params.get("comment") || null,
    };
  }
  const spec = params.get("spec");
  if (spec) return { area: "spec", spec };
  if (params.has("settings")) {
    const section = params.get("settings");
    return {
      area: "settings",
      section: settingsSections.find(item => item === section) ?? "project",
    };
  }
  if (params.has("comments")) {
    const filter = params.get("comments");
    return {
      area: "comments",
      filter: filter === "waiting" || filter === "resolved" ? filter : "open",
    };
  }
  if (params.has("drafts")) return { area: "drafts" };
  if (params.has("flows")) return { area: "flows" };
  if (params.has("screens")) return { area: "screens" };
  return { area: "overview" };
}

/** The search string (`?…`, or `""` for the overview) of a location. */
export function viewSearch({ view, theme }: Location) {
  const entries: [string, string][] = [];
  switch (view.area) {
    case "overview":
      break;
    case "spec":
      entries.push(["spec", view.spec]);
      break;
    case "flow":
      entries.push(["flow", view.flow]);
      if (view.node) entries.push(["node", view.node]);
      break;
    case "screen":
      entries.push(["p", view.slug]);
      if (view.state) entries.push(["state", view.state]);
      if (view.width !== "fit") entries.push(["w", String(view.width)]);
      if (view.role) entries.push(["role", view.role]);
      if (view.compare) entries.push(["compare", "themes"]);
      if (view.comment) entries.push(["comment", view.comment]);
      break;
    case "settings":
      entries.push(["settings", view.section]);
      break;
    case "comments":
      entries.push(["comments", view.filter]);
      break;
    case "drafts":
    case "flows":
    case "screens":
      entries.push([view.area, ""]);
      break;
  }
  if (theme !== "system") entries.push(["theme", theme]);
  const search = entries.map(([key, value]) =>
    value ? `${key}=${encodeURIComponent(value)}` : key
  );
  return search.length ? `?${search.join("&")}` : "";
}

/** A screen view of a prototype state, with the defaults every link starts from. */
export function screenView(
  slug: string,
  state: string | null = null,
  options: Partial<Extract<View, { area: "screen" }>> = {}
): View {
  return {
    area: "screen",
    slug,
    state,
    width: "fit",
    role: null,
    compare: false,
    comment: null,
    ...options,
  };
}

/** The rail area a view belongs to. */
export function areaOf(view: View) {
  switch (view.area) {
    case "spec":
      return "overview";
    case "flow":
      return "flows";
    case "screen":
      return "screens";
    default:
      return view.area;
  }
}
