/**
 * The registry snapshot: what discovery produces in Node and what every client reads —
 * `GET registry` (dev router and remote server), `dist-proto/__proto/registry.json` (static
 * build), the shell, and the projections of `proto list --json` / `proto check --json`.
 * File paths are app-relative POSIX. Pure: no Node, no DOM.
 */

import type { ResolvedEdge, ResolvedNode } from "../flow.ts";
import type { ProblemCode, WarningCode } from "./errors.ts";

export type { ResolvedEdge, ResolvedNode } from "../flow.ts";

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
  code: WarningCode;
  message: string;
  file?: string;
  proto?: string;
  state?: string;
  spec?: string;
};

export type Registry = {
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
