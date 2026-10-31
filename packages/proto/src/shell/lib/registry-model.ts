/**
 * What the shell derives from a registry snapshot: spec groups, flow kinds and occurrences,
 * coverage and problems per item. Pure: no DOM.
 */
import type {
  Registry,
  RegistryFlow,
  RegistryPrototype,
  RegistryWarning,
  ResolvedNode,
} from "../../model/registry";

export type SpecGroup = {
  id: string;
  title: string;
  prototypes: RegistryPrototype[];
  flows: RegistryFlow[];
};

export type Groups = {
  specs: SpecGroup[];
  /** Component prototypes without a spec. */
  unsorted: RegistryPrototype[];
  drafts: RegistryPrototype[];
};

export function specTitle(registry: Registry, spec: string) {
  return registry.specs?.[spec] ?? spec;
}

export function flowsOfSpec(registry: Registry, spec: string) {
  return registry.flows.filter(
    flow => flow.spec === spec || (!flow.spec && flow.specs.includes(spec))
  );
}

/**
 * Overview groups: every configured spec (in config order), then specs only prototypes name
 * (unknown or unavailable catalog), then unsorted components and drafts.
 */
export function groupRegistry(registry: Registry): Groups {
  const ids = Object.keys(registry.specs ?? {});
  for (const item of [...registry.prototypes, ...registry.flows]) {
    if (item.spec && !ids.includes(item.spec)) ids.push(item.spec);
  }
  const specs = ids.map(id => ({
    id,
    title: specTitle(registry, id),
    prototypes: registry.prototypes.filter(item => item.spec === id),
    flows: flowsOfSpec(registry, id),
  }));
  return {
    specs,
    unsorted: registry.prototypes.filter(item => !item.spec && item.kind === "component"),
    drafts: registry.prototypes.filter(item => !item.spec && item.kind === "draft"),
  };
}

/** Prototypes in browsing order (spec groups, unsorted, drafts): what `[` and `]` walk. */
export function orderedPrototypes(registry: Registry) {
  const groups = groupRegistry(registry);
  return [...groups.specs.flatMap(group => group.prototypes), ...groups.unsorted, ...groups.drafts];
}

export function stateCount(prototypes: readonly RegistryPrototype[]) {
  return prototypes.reduce((total, item) => total + item.states.length, 0);
}

/** The state a URL asks for, or the default (first) state flagged as unknown. */
export function resolveState(prototype: RegistryPrototype, requested: string | null) {
  const found = requested ? prototype.states.find(state => state.id === requested) : undefined;
  return {
    state: found ?? prototype.states[0],
    unknown: requested !== null && !found ? requested : null,
  };
}

export type RoleOption = { value: string | null; label: string };

/** Declared roles, else every configured role plus the prototype's own default (`null`). */
export function roleOptions(registry: Registry, prototype: RegistryPrototype): RoleOption[] {
  if (prototype.roles.length) {
    return prototype.roles.map(role => ({ value: role, label: registry.roles[role] ?? role }));
  }
  const all = Object.entries(registry.roles).map(([value, label]) => ({ value, label }));
  return all.length ? [{ value: null, label: "" }, ...all] : [];
}

export function resolveRole(
  registry: Registry,
  prototype: RegistryPrototype,
  requested: string | null
) {
  const options = roleOptions(registry, prototype);
  if (!options.length) return null;
  return options.find(option => option.value === requested)?.value ?? options[0]?.value ?? null;
}

/** Visual kind of a step (`_uiux.md` kind eyebrows). */
export type StepKind = "start" | "screen" | "overlay" | "redirect" | "external" | "end";

export function stepKind(flow: RegistryFlow, node: ResolvedNode): StepKind {
  if (node.start) return "start";
  if (node.end) return "end";
  if (node.kind === "external") return "external";
  const incoming = flow.edges.filter(edge => edge.to === node.id);
  if (incoming.some(edge => edge.kind === "redirect")) return "redirect";
  if (incoming.length && incoming.every(edge => edge.kind === "overlay")) return "overlay";
  return "screen";
}

export type Occurrence = { flow: RegistryFlow; node: ResolvedNode };

/** Flow steps that show a prototype (optionally one state of it). */
export function occurrences(registry: Registry, slug: string, state?: string): Occurrence[] {
  return registry.flows.flatMap(flow =>
    flow.nodes
      .filter(
        node => node.kind === "prototype" && node.proto === slug && (!state || node.state === state)
      )
      .map(node => ({ flow, node }))
  );
}

/** `uncovered_state` warnings of a prototype. */
export function uncoveredStates(registry: Registry, slug: string): RegistryWarning[] {
  return registry.warnings.filter(item => item.code === "uncovered_state" && item.proto === slug);
}

/** Uncovered states of the prototypes a flow visits. */
export function flowCoverage(registry: Registry, flow: RegistryFlow) {
  const visited = new Set(
    flow.nodes.flatMap(node => (node.kind === "prototype" ? [node.proto] : []))
  );
  return registry.warnings.filter(
    item => item.code === "uncovered_state" && item.proto && visited.has(item.proto)
  );
}

export function flowProblems(registry: Registry, flow: string) {
  return registry.problems.filter(problem => problem.flow === flow);
}

/** Steps in walk order (BFS step numbers; unreachable nodes last). */
export function orderedSteps(flow: RegistryFlow) {
  return [...flow.nodes].sort((a, b) => (a.step || Infinity) - (b.step || Infinity));
}

export function nodeTitle(node: ResolvedNode) {
  return node.kind === "prototype" ? node.stateLabel : node.label;
}

export function nodeSubtitle(node: ResolvedNode) {
  if (node.kind === "prototype") return `${node.route || "/"} · ${node.state}`;
  return node.url ? displayUrl(node.url) : node.external;
}

/** `https://example.com/#pricing` → `example.com/#pricing`. */
export function displayUrl(url: string) {
  return url.replace(/^https?:\/\//, "");
}

export function padNumber(value: number) {
  return String(value).padStart(2, "0");
}
