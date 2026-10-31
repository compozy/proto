export type ExternalService = "site" | "auth" | "payment" | "email" | "other";
export type EdgeKind = "navigate" | "overlay" | "redirect" | "external";
export type PrototypeNode = { proto: string; state: string; role?: string; end?: boolean };
export type ExternalNode = {
  external: ExternalService;
  label?: string;
  url?: string;
  end?: boolean;
};
export type FlowNode = PrototypeNode | ExternalNode;
export type FlowEdge = readonly [
  from: string,
  to: string,
  options: { on: string; kind?: EdgeKind },
];
export type FlowDefinition = {
  title: string;
  spec?: string;
  description?: string;
  start: readonly [string, ...string[]];
  nodes: Record<string, FlowNode>;
  edges: readonly FlowEdge[];
};

export function defineFlow<const Flow extends FlowDefinition>(flow: Flow): Flow {
  return flow;
}

export const externalLabels: Record<ExternalService, string> = {
  site: "Website",
  auth: "Identity provider",
  payment: "Payment",
  email: "Email",
  other: "",
};

export const edgeKinds: readonly EdgeKind[] = ["navigate", "overlay", "redirect", "external"];

type NodePosition = { id: string; end: boolean; start: boolean; step: number };
export type ResolvedNode = NodePosition &
  (
    | {
        kind: "prototype";
        proto: string;
        state: string;
        stateLabel: string;
        title: string;
        route: string;
        spec: string | null;
        role?: string;
      }
    | { kind: "external"; external: ExternalService; label: string; url: string | null }
  );
export type ResolvedEdge = { from: string; to: string; on: string; kind: EdgeKind };
export type FlowEntry = {
  id: string;
  file: string;
  title: string;
  description: string | null;
  spec: string | null;
  start: string[];
  specs: string[];
  nodes: ResolvedNode[];
  edges: ResolvedEdge[];
};
export type FlowProblemCode =
  | "flow_outside_root"
  | "invalid_flow_id"
  | "missing_flow"
  | "invalid_flow"
  | "unknown_spec"
  | "unknown_prototype"
  | "unknown_state"
  | "unknown_role"
  | "duplicate_node"
  | "invalid_node"
  | "unknown_node"
  | "duplicate_edge"
  | "unreachable"
  | "dead_end";
export type FlowProblem = {
  code: FlowProblemCode;
  flow: string | null;
  file: string;
  node?: string;
  message: string;
};
export type CoverageWarning = {
  code: "uncovered_state";
  spec: string;
  slug: string;
  state: string;
};
export type Occurrence = { flow: string; node: string; step: number; steps: number };

/** Comments of flow `<id>` live under `flow-<id>`, a prefix prototype slugs cannot use. */
export const flowKeyPrefix = "flow-";
export const flowKey = (flow: string) => `${flowKeyPrefix}${flow}`;
export function flowOfKey(slug: string) {
  return slug.startsWith(flowKeyPrefix) ? slug.slice(flowKeyPrefix.length) : null;
}
