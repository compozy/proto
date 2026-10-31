import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { defineCommand } from "citty";
import { membership } from "../../flow-graph";
import { findPrototypes } from "../../node/discovery";
import { findFlows, validFlowId } from "../../node/flows";
import { flowListRow, flowShowJson } from "../../node/flow-output";
import { currentApp, repoRoot } from "../../node/paths";
import { galleryOrigin } from "../comments";

function registry() {
  const { appRoot, config } = currentApp();
  const prototypes = findPrototypes(appRoot, repoRoot, config);
  return {
    prototypes: prototypes.entries,
    ...findFlows(appRoot, repoRoot, prototypes.entries, config),
  };
}
function knownSpec(spec: string | undefined) {
  if (spec && !Object.hasOwn(currentApp().config.specs, spec))
    throw new Error(`unknown spec "${spec}" (not in gallery.config.ts)`);
}
function entry(id: string) {
  const result = registry();
  const found = result.flows.find(flow => flow.id === id);
  if (!found) {
    const problems = result.problems.filter(problem => problem.flow === id);
    throw new Error(
      problems.length
        ? problems.map(problem => `${problem.file}: ${problem.message}`).join("\n")
        : `Unknown flow "${id}"`
    );
  }
  return found;
}
const filterArgs = { spec: { type: "string" }, json: { type: "boolean" } } as const;
const idArgs = { id: { type: "positional", required: true }, json: { type: "boolean" } } as const;

export default defineCommand({
  meta: { description: "Author and inspect prototype flows" },
  subCommands: {
    new: defineCommand({
      meta: { description: "Create a flow that passes validation" },
      args: {
        id: { type: "positional", required: true },
        spec: { type: "string" },
      },
      run({ args }) {
        if (!validFlowId(args.id)) throw new Error(`Invalid flow id "${args.id}"`);
        knownSpec(args.spec);
        const { appRoot } = currentApp();
        const folder = resolve(appRoot, "flows");
        mkdirSync(folder, { recursive: true });
        if (relative(realpathSync(appRoot), realpathSync(folder)) !== "flows")
          throw new Error("Flow path escapes the app");
        const file = resolve(folder, `${args.id}.flow.ts`);
        const flow = {
          title: "New flow",
          ...(args.spec ? { spec: args.spec } : {}),
          start: ["site"],
          nodes: { site: { external: "site", end: true } },
          edges: [],
        };
        try {
          writeFileSync(
            file,
            `import { defineFlow } from "../../flow";\n\nexport const flow = defineFlow(${JSON.stringify(flow, null, 2)});\n`,
            { flag: "wx" }
          );
        } catch (error) {
          if (error instanceof Error && "code" in error && error.code === "EEXIST")
            throw new Error(`${relative(repoRoot, file)} already exists`);
          throw error;
        }
        console.log(`Created ${relative(repoRoot, file)}`);
      },
    }),
    list: defineCommand({
      meta: { description: "List flows owned or crossed by a spec" },
      args: filterArgs,
      run({ args }) {
        knownSpec(args.spec);
        const rows = registry()
          .flows.filter(flow => !args.spec || flow.specs.includes(args.spec))
          .map(flowListRow);
        console.log(
          args.json
            ? JSON.stringify(rows)
            : rows
                .map(
                  flow =>
                    `${flow.id}\t${flow.spec ?? "-"}\t${flow.specs.length} specs\t${flow.nodes} nodes\t${flow.edges} edges\t${flow.file}`
                )
                .join("\n")
        );
      },
    }),
    show: defineCommand({
      meta: { description: "Show a resolved flow" },
      args: idArgs,
      run({ args }) {
        const flow = entry(args.id);
        const label = (id: string) => {
          const node = flow.nodes.find(node => node.id === id)!;
          return node.kind === "prototype" ? `${node.title} (${node.state})` : node.label;
        };
        console.log(
          args.json
            ? JSON.stringify(flowShowJson(flow))
            : flow.edges
                .map(edge => `${label(edge.from)} → ${label(edge.to)} · ${edge.on} · ${edge.kind}`)
                .join("\n")
        );
      },
    }),
    coverage: defineCommand({
      meta: { description: "Show which flows use each prototype state" },
      args: filterArgs,
      run({ args }) {
        knownSpec(args.spec);
        const { flows, prototypes } = registry();
        const used = membership(flows);
        const rows = prototypes
          .filter(prototype => prototype.meta && (!args.spec || prototype.meta.spec === args.spec))
          .map(prototype => ({
            slug: prototype.slug,
            states: prototype.meta!.states.map(state => ({
              id: state.id,
              flows: [
                ...new Set(
                  (used.get(`${prototype.slug}:${state.id}`) ?? []).map(item => item.flow)
                ),
              ],
            })),
          }));
        console.log(
          args.json
            ? JSON.stringify(rows)
            : rows
                .map(row => {
                  const missing = row.states
                    .filter(state => !state.flows.length)
                    .map(state => state.id);
                  return `${row.slug}\t${row.states.length - missing.length}/${row.states.length}${missing.length ? `\tmissing: ${missing.join(", ")}` : ""}`;
                })
                .join("\n")
        );
      },
    }),
    url: defineCommand({
      meta: { description: "Print a flow URL" },
      args: { id: idArgs.id, node: { type: "string" } },
      run({ args }) {
        const flow = entry(args.id);
        if (args.node && !flow.nodes.some(node => node.id === args.node))
          throw new Error(`Unknown node "${args.node}" in flow "${flow.id}"`);
        const url = new URL("/", galleryOrigin);
        url.searchParams.set("flow", flow.id);
        if (args.node) url.searchParams.set("node", args.node);
        console.log(url.href);
      },
    }),
  },
});
