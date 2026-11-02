/** CPU-only graph workload, separate from browser/Vite startup. Five samples after warmup. */
import { bfsOrder } from "../src/flow-graph.ts";
import type { RegistryFlow } from "../src/model/registry.ts";
import { layoutFlow } from "../src/shell/flow/layout.ts";

const results = [1000, 10000].map(count => {
  const flow: RegistryFlow = {
    id: "chain",
    title: "Chain",
    file: "flows/chain.flow.ts",
    description: null,
    spec: null,
    specs: [],
    steps: count,
    start: ["0"],
    nodes: Array.from({ length: count }, (_, index) => ({
      id: String(index),
      kind: "external",
      external: "other",
      label: String(index),
      url: null,
      start: index === 0,
      end: index === count - 1,
      step: index + 1,
    })),
    edges: Array.from({ length: count - 1 }, (_, index) => ({
      from: String(index),
      to: String(index + 1),
      on: "Next",
      kind: "navigate",
    })),
  };
  const measure = (run: () => number) => {
    if (run() !== count) throw new Error("Incomplete graph");
    return Array.from({ length: 5 }, () => {
      const start = performance.now();
      if (run() !== count) throw new Error("Incomplete graph");
      return performance.now() - start;
    });
  };
  return {
    nodes: count,
    bfsMs: measure(() => bfsOrder(flow.start, flow.edges).length),
    layoutMs: measure(() => layoutFlow(flow).nodes.length),
  };
});
console.log(JSON.stringify(results, null, 2));
