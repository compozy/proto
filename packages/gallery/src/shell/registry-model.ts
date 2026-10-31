/**
 * Pure model behind the gallery navigation: prototypes grouped by spec (the app's
 * `gallery.config.ts` order, then "Unsorted") with the flows each spec owns or is crossed by, the
 * "Journeys" list, flow membership of every prototype state and coverage warnings. `registry.ts`
 * feeds it from `virtual:gallery-prototypes`; tests feed it fixtures.
 */
import type { PrototypeMeta } from "../contract";
import type { CoverageWarning, FlowEntry, FlowProblem, Occurrence } from "../flow";
import { flowCount, membership } from "../flow-graph";

export type Entry = {
  slug: string;
  kind: "draft" | "component";
  file: string;
  meta: PrototypeMeta;
};
/** A spec id from `gallery.config.ts`, or `unsorted` for prototypes and flows without one. */
export type GroupId = string;
export const unsorted = "unsorted";
export type Group = {
  id: GroupId;
  title: string;
  entries: Entry[];
  /** Flows this spec owns (`spec` field), in title order. */
  flows: FlowEntry[];
  /** Flows owned by other specs with at least one prototype node of this spec. */
  crossing: FlowEntry[];
};
export type Registry = {
  specs: Readonly<Record<string, string>>;
  groups: Group[];
  entries: Entry[];
  broken: string[];
  /** Every valid flow, by owner spec in `specs` order, then title ("Journeys"). */
  flows: FlowEntry[];
  flowProblems: FlowProblem[];
  warnings: CoverageWarning[];
  /** `${slug}:${state}` → every node using that state, in flow then step order. */
  membership: Map<string, Occurrence[]>;
};

type RegistryInput = {
  /** Spec id → title, in gallery order. */
  specs: Readonly<Record<string, string>>;
  entries: Entry[];
  broken: string[];
  flows: readonly FlowEntry[];
  flowProblems: readonly FlowProblem[];
  warnings: readonly CoverageWarning[];
};

function bySurface(a: Entry, b: Entry) {
  return a.meta.surface.localeCompare(b.meta.surface, "en", { numeric: true });
}

function byTitle(a: FlowEntry, b: FlowEntry) {
  return a.title.localeCompare(b.title, "en");
}

/** The group of a spec field: a known spec, else "Unsorted". */
function groupOfSpec(specs: Readonly<Record<string, string>>, spec: string | null | undefined) {
  return spec && Object.hasOwn(specs, spec) ? spec : unsorted;
}

export function sortFlows(flows: readonly FlowEntry[], specs: Readonly<Record<string, string>>) {
  const order = Object.keys(specs);
  const index = (spec: string | null) => {
    const position = spec === null ? -1 : order.indexOf(spec);
    return position === -1 ? order.length : position;
  };
  return [...flows].sort((a, b) => index(a.spec) - index(b.spec) || byTitle(a, b));
}

/**
 * Spec groups in `specs` order, then "Unsorted" (prototypes and flows without a known spec). A
 * group is listed when it has prototypes or owns flows.
 */
export function buildRegistry(input: RegistryInput): Registry {
  const { specs } = input;
  const entries = [...input.entries].sort(bySurface);
  const flows = sortFlows(input.flows, specs);
  const groups: Group[] = [...Object.keys(specs), unsorted].map(id => ({
    id,
    title: id === unsorted ? "Unsorted" : specs[id]!,
    entries: entries.filter(entry => groupOfSpec(specs, entry.meta.spec) === id),
    flows: flows.filter(flow => groupOfSpec(specs, flow.spec) === id).sort(byTitle),
    crossing: flows.filter(
      flow => groupOfSpec(specs, flow.spec) !== id && id !== unsorted && flow.specs.includes(id)
    ),
  }));
  const listed = groups.filter(group => group.entries.length > 0 || group.flows.length > 0);
  return {
    specs,
    groups: listed,
    entries: listed.flatMap(group => group.entries),
    broken: input.broken,
    flows,
    flowProblems: [...input.flowProblems],
    warnings: [...input.warnings],
    membership: membership(flows),
  };
}

export function flowMatches(flow: FlowEntry, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [flow.title, flow.id].some(value => value.toLowerCase().includes(needle));
}

export function groupOf(registry: Registry, id: GroupId | null | undefined) {
  return registry.groups.find(group => group.id === id);
}

/** Position of a spec in the gallery order (printed `01`, `02`…); "Unsorted" has none. */
export function specPosition(registry: Registry, id: GroupId) {
  return id === unsorted ? null : registry.groups.findIndex(group => group.id === id);
}

/** The spec's slug as printed ("no spec" for "Unsorted"). */
export function specSlug(group: Group) {
  return group.id === unsorted ? "no spec" : group.id;
}

export function specOfEntry(registry: Registry, entry: Entry): GroupId {
  return groupOfSpec(registry.specs, entry.meta.spec);
}

export function specOfFlow(registry: Registry, flow: FlowEntry): GroupId {
  return groupOfSpec(registry.specs, flow.spec);
}

export type ActiveSelection =
  | { kind: "flow"; flow: FlowEntry }
  | { kind: "prototype"; entry: Entry | null }
  | { kind: "missing-flow" };

/** The spec the screen belongs to: a flow's owner, or the open prototype's spec. */
export function activeSpec(registry: Registry, selection: ActiveSelection): GroupId | null {
  if (selection.kind === "flow") return specOfFlow(registry, selection.flow);
  if (selection.kind === "prototype" && selection.entry)
    return specOfEntry(registry, selection.entry);
  return null;
}

export type SpecTab = "flows" | "screens";

/** "Flows | Screens" only when the spec owns a flow and has a prototype. */
export function specTabs(group: Group | undefined): SpecTab[] {
  return group && group.flows.length > 0 && group.entries.length > 0 ? ["flows", "screens"] : [];
}

/**
 * Uncovered states in the specs this flow owns or crosses (the canvas "N warnings"), the same
 * scope `proto check` reports.
 */
export function flowWarnings(registry: Registry, flow: FlowEntry) {
  const specsOfFlow = new Set(flow.specs);
  return registry.warnings.filter(warning => specsOfFlow.has(warning.spec));
}

/** Whether any flow owns or crosses this spec (state counts and dots only show then). */
export function touchedByFlows(registry: Registry, spec: GroupId) {
  return registry.flows.some(flow => flow.specs.includes(spec));
}

export function occurrencesOf(registry: Registry, slug: string, state: string) {
  return registry.membership.get(`${slug}:${state}`) ?? [];
}

export function stateFlowCount(registry: Registry, slug: string, state: string) {
  return flowCount(occurrencesOf(registry, slug, state));
}

export function isUncovered(registry: Registry, slug: string, state: string) {
  return registry.warnings.some(warning => warning.slug === slug && warning.state === state);
}

export function flowById(registry: Registry, id: string) {
  return registry.flows.find(flow => flow.id === id);
}
