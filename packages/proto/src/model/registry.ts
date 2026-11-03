/**
 * The registry snapshot: what discovery produces in Node and what every client reads —
 * `GET registry` (dev router and remote server), `dist-proto/__proto/registry.json` (static
 * build), the shell, and the projections of `proto list --json` / `proto check --json`.
 * File paths are app-relative POSIX. Pure: no Node, no DOM.
 */

import type { ResolvedEdge, ResolvedNode } from "../flow.ts";
import type { ProblemCode, WarningCode } from "./errors.ts";

export type { ResolvedEdge, ResolvedNode } from "../flow.ts";

/** Preserve authored edge order while visiting each edge only once during graph traversal. */
export function outgoingEdges(edges: readonly ResolvedEdge[]) {
  const outgoing = new Map<string, ResolvedEdge[]>();
  for (const edge of edges) {
    const group = outgoing.get(edge.from);
    if (group) group.push(edge);
    else outgoing.set(edge.from, [edge]);
  }
  return outgoing;
}

export type PrototypeKind = "component" | "draft";

export type RegistryState = { id: string; label: string };

export type RegistryPrototype = {
  slug: string;
  kind: PrototypeKind;
  /** App-relative POSIX path, e.g. `src/components/login-form.proto.tsx`. */
  file: string;
  title: string;
  spec: string | null;
  surface: string | null;
  route: string | null;
  blocks: string[];
  roles: string[];
  standalone: boolean;
  states: [RegistryState, ...RegistryState[]];
};

export type RegistryFlow = {
  id: string;
  file: string;
  title: string;
  description: string | null;
  spec: string | null;
  start: string[];
  /** Specs of the prototypes the flow visits. */
  specs: string[];
  /** Number of reachable steps (BFS from `start`). */
  steps: number;
  nodes: ResolvedNode[];
  edges: ResolvedEdge[];
};

/** A problem fails `check` and `build`. `line`/`column` are 1-based when known. */
export type RegistryProblem = {
  root?: string;
  code: ProblemCode;
  file: string;
  message: string;
  line?: number;
  column?: number;
  slug?: string;
  flow?: string;
  node?: string;
  /** `network_import`: the import chain from the prototype or story to the forbidden module. */
  chain?: string[];
};

/** A warning never fails a build. */
export type RegistryWarning = {
  root?: string;
  code: WarningCode;
  message: string;
  file?: string;
  proto?: string;
  state?: string;
  spec?: string;
};

export type RegistryStory = {
  id: string;
  exportName: string;
  name: string;
  play: boolean;
  tags: string[];
};
export type RegistryStoryFile = {
  slug: string;
  root: string;
  file: string;
  title: string;
  path: string[];
  description: string | null;
  stories: [RegistryStory, ...RegistryStory[]];
};
export type RegistryStoryRoot = { id: string; title: string };
export type Registry = {
  storyRoots?: RegistryStoryRoot[];
  stories?: RegistryStoryFile[];
  sourceRoots?: import("./source.ts").SourceRoots;
  title: string;
  locale: "en" | "pt-BR";
  /** `null` when the `specs` function returned null (warning `specs_unavailable`). */
  specs: Record<string, string> | null;
  roles: Record<string, string>;
  siteUrl: string | null;
  prototypes: RegistryPrototype[];
  flows: RegistryFlow[];
  problems: RegistryProblem[];
  warnings: RegistryWarning[];
};

/** Review keys: a prototype slug or `flow-<flow id>`. */
export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const specIdPattern = /^[a-z0-9][a-z0-9_-]*$/;
export const flowKeyPrefix = "flow-";
export const flowKey = (flow: string) => `${flowKeyPrefix}${flow}`;
export function flowOfKey(key: string) {
  return key.startsWith(flowKeyPrefix) ? key.slice(flowKeyPrefix.length) : null;
}

/** Every review key of the registry: prototype slugs and `flow-<id>`. */
export const storyKeyPrefix = "story--";
export const storyKey = (slug: string) => `${storyKeyPrefix}${slug}`;
export function storyOfKey(key: string): string | null {
  const slug = key.slice(storyKeyPrefix.length);
  return key.startsWith(storyKeyPrefix) && slugPattern.test(slug) && key.length <= 200
    ? slug
    : null;
}
export type ReviewKeyKind = "prototype" | "flow" | "story";
export function keyKind(key: string): ReviewKeyKind {
  return storyOfKey(key) !== null ? "story" : flowOfKey(key) !== null ? "flow" : "prototype";
}
export function reviewKeys(registry: {
  prototypes: { slug: string }[];
  flows: { id: string }[];
  stories?: { slug: string }[];
}) {
  return [
    ...(registry.stories ?? []).map(item => storyKey(item.slug)),
    ...registry.prototypes.map(item => item.slug),
    ...registry.flows.map(item => flowKey(item.id)),
  ];
}
