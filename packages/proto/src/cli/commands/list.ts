import { defineCommand } from "citty";

import { countComments } from "../../node/comments-store";
import { findPrototypes } from "../../node/discovery";
import { currentApp, repoRoot } from "../../node/paths";

export default defineCommand({
  meta: { description: "List prototypes" },
  args: {
    spec: { type: "string" },
    kind: { type: "enum", options: ["draft", "component"] },
    json: { type: "boolean" },
  },
  run({ args }) {
    const { appRoot, config } = currentApp();
    const counts = countComments();
    const entries = findPrototypes(appRoot, repoRoot, config)
      .entries.filter(
        entry =>
          (!args.spec || entry.meta?.spec === args.spec) && (!args.kind || entry.kind === args.kind)
      )
      .map(entry => ({
        slug: entry.slug,
        kind: entry.kind,
        spec: entry.meta?.spec,
        surface: entry.meta?.surface,
        route: entry.meta?.route,
        states: entry.meta?.states.map(state => state.id) ?? [],
        file: entry.file,
        openComments: counts[entry.slug]?.open ?? 0,
      }));
    console.log(
      args.json
        ? JSON.stringify(entries)
        : entries
            .map(
              entry =>
                `${entry.slug}\t${entry.kind}\t${entry.surface}\t${entry.route}\t${entry.states.length} states\t${entry.openComments} open\t${entry.file}`
            )
            .join("\n")
    );
  },
});
