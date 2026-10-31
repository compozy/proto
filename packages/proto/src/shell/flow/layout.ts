/**
 * Layered flow layout: a step's column is its distance from `start` (BFS over the edges), steps
 * of one column stack vertically in walk order and the column is centered. Back edges (to an
 * earlier column) loop under the cards; edges within a column run bottom → top. Small,
 * deterministic and dependency-free (ELK alone would exceed the shell's bundle budget). Pure.
 */
import type { RegistryFlow } from "../../model/registry";

export const cardWidth = 248;
export const columnGap = 112;
export const rowGap = 56;
/** Card heights: prototype steps carry a preview, external ones do not. */
export const prototypeHeight = 236;
export const externalHeight = 96;

export type LaidOutNode = { id: string; x: number; y: number; column: number; height: number };
export type EdgeRoute = "forward" | "back" | "same";

export function layoutFlow(flow: RegistryFlow) {
  const depth = new Map<string, number>();
  const queue = flow.start.filter(id => flow.nodes.some(node => node.id === id));
  for (const id of queue) depth.set(id, 0);
  while (queue.length) {
    const id = queue.shift() as string;
    const next = (depth.get(id) ?? 0) + 1;
    for (const edge of flow.edges) {
      if (edge.from === id && !depth.has(edge.to)) {
        depth.set(edge.to, next);
        queue.push(edge.to);
      }
    }
  }
  // Unreachable steps (a flow with problems) go in a last column.
  const last = Math.max(0, ...depth.values()) + 1;
  const ordered = [...flow.nodes].sort((a, b) => (a.step || Infinity) - (b.step || Infinity));
  const columns = new Map<number, typeof ordered>();
  for (const node of ordered) {
    const column = depth.get(node.id) ?? last;
    columns.set(column, [...(columns.get(column) ?? []), node]);
  }
  const heightOf = (node: (typeof ordered)[number]) =>
    node.kind === "prototype" ? prototypeHeight : externalHeight;
  const nodes: LaidOutNode[] = [];
  for (const [column, members] of columns) {
    const total =
      members.reduce((sum, node) => sum + heightOf(node), 0) + rowGap * (members.length - 1);
    let y = -total / 2;
    for (const node of members) {
      const height = heightOf(node);
      nodes.push({ id: node.id, x: column * (cardWidth + columnGap), y, column, height });
      y += height + rowGap;
    }
  }
  const byId = new Map(nodes.map(node => [node.id, node]));
  const route = (from: string, to: string): EdgeRoute => {
    const a = byId.get(from)?.column ?? 0;
    const b = byId.get(to)?.column ?? 0;
    return b > a ? "forward" : b < a ? "back" : "same";
  };
  return { nodes, byId, route };
}
