import { defineCommand } from "citty";
import { loadProject } from "../../node/project.ts";
import { currentApp } from "../../node/paths.ts";
export default defineCommand({
  args: { json: { type: "boolean" }, spec: { type: "string" }, kind: { type: "string" } },
  async run({ args }) {
    const registry = await (await loadProject(currentApp().appRoot)).registry();
    const entries = registry.prototypes.filter(
      p => (!args.spec || p.spec === args.spec) && (!args.kind || p.kind === args.kind)
    );
    console.log(
      args.json
        ? JSON.stringify(entries)
        : entries.map(p => `${p.slug}\t${p.kind}\t${p.file}`).join("\n")
    );
  },
});
