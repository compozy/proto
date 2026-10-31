import type { CoverageWarning, FlowEntry, Occurrence, ResolvedEdge } from "./flow.ts";

export type { Occurrence } from "./flow.ts";

export function bfsOrder(start: readonly string[], edges: readonly ResolvedEdge[]): string[] {
  const order = [...new Set(start)];
  const seen = new Set(order);
  for (let i = 0; i < order.length; i++) {
    for (const edge of edges) {
      if (edge.from !== order[i] || seen.has(edge.to)) continue;
      seen.add(edge.to);
      order.push(edge.to);
    }
  }
  return order;
}

export function unreachable(nodeIds: readonly string[], order: readonly string[]): string[] {
  const reached = new Set(order);
  return nodeIds.filter(id => !reached.has(id));
}

export function deadEnds(
  nodes: readonly { id: string; end: boolean }[],
  edges: readonly ResolvedEdge[]
): string[] {
  const sources = new Set(edges.map(edge => edge.from));
  return nodes.filter(node => !node.end && !sources.has(node.id)).map(node => node.id);
}

export function duplicateEdges(edges: readonly ResolvedEdge[]): ResolvedEdge[] {
  const seen = new Set<string>();
  return edges.filter(({ from, to, on }) => {
    const key = JSON.stringify([from, to, on]);
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });
}

export function membership(flows: readonly FlowEntry[]): Map<string, Occurrence[]> {
  const result = new Map<string, Occurrence[]>();
  for (const flow of flows) {
    for (const node of flow.nodes) {
      if (node.kind !== "prototype") continue;
      const key = `${node.proto}:${node.state}`;
      const occurrences = result.get(key) ?? [];
      occurrences.push({ flow: flow.id, node: node.id, step: node.step, steps: flow.nodes.length });
      result.set(key, occurrences);
    }
  }
  return result;
}

export function flowCount(occurrences: readonly Occurrence[]): number {
  return new Set(occurrences.map(occurrence => occurrence.flow)).size;
}

export function coverage(
  flows: readonly FlowEntry[],
  prototypes: readonly { slug: string; spec?: string; states: readonly string[] }[]
): CoverageWarning[] {
  const touched = new Set(flows.flatMap(flow => flow.specs));
  const used = membership(flows);
  return prototypes.flatMap(prototype => {
    const { spec, slug } = prototype;
    if (!spec || !touched.has(spec)) return [];
    return prototype.states
      .filter(state => !used.has(`${slug}:${state}`))
      .map(state => ({ code: "uncovered_state" as const, spec, slug, state }));
  });
}
