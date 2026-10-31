import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ProtoProject } from "./project.ts";
import type { Plugin } from "vite";

/**
 * Fails a production build when a prototype-only module reaches a chunk: prototypes, fixtures,
 * stories, drafts, flows, the gallery package, preview wiring or Storybook config.
 */
export function productionBoundary(project?: Pick<ProtoProject, "root" | "config">): Plugin {
  const prototypeOnly =
    /\.(proto|fixtures|stories)\.[cm]?[jt]sx?(?:\?|$)|\/src\/drafts\/|\/apps\/[^/]+\/(flows|preview|gallery|\.storybook)\/|\/packages\/(?:gallery|proto)\//;
  const roots = [
    fileURLToPath(new URL("../../", import.meta.url)),
    ...(project
      ? [project.config.flows, project.config.drafts, "preview", ".storybook"].map(path =>
          resolve(project.root, path)
        )
      : []),
  ];
  const forbidden = (raw: string) => {
    const id = raw.replaceAll("\\", "/").split("?")[0]!;
    return (
      prototypeOnly.test(id) ||
      id.includes("/node_modules/@compozy/proto/") ||
      roots.some(root => id.startsWith(root.replace(/\/$/, "") + "/")) ||
      (!!project && id === resolve(project.root, project.config.canvas))
    );
  };
  return {
    name: "gallery:production-boundary",
    generateBundle(_options, bundle) {
      for (const id of this.getModuleIds())
        if (forbidden(id))
          this.error(
            `production_boundary: Prototype-only module reached the production graph: ${id}`
          );
      for (const output of Object.values(bundle)) {
        if (output.type !== "chunk") continue;
        for (const id of Object.keys(output.modules)) {
          if (forbidden(id))
            this.error(
              `production_boundary: Prototype-only module reached the production bundle: ${id}`
            );
        }
      }
    },
  };
}
