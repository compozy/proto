import { resolve, matchesGlob } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import type { StoryRootConfig } from "../config.ts";
import type { ProtoProject } from "../node/project.ts";
/** Peers stay bare so the root optimizer owns their module instances. */
export function storyPlugins(
  project: ProtoProject,
  root: StoryRootConfig,
  shellOrigin: string
): Plugin[] {
  const dir = resolve(project.root, root.dir ?? ".");
  const ids = [
    "virtual:proto/story-config",
    "virtual:proto/story-entries",
    "virtual:proto/story-runtime",
    "virtual:proto/story-preview",
  ];
  return [
    {
      name: "proto:stories",
      enforce: "pre",
      async resolveId(id, importer) {
        if (ids.includes(id)) return `\0${id}`;
        if (importer === `\0${ids[2]}` && !id.startsWith("."))
          return this.resolve(id, resolve(dir, "package.json"), { skipSelf: true });
      },
      async load(id) {
        if (id === `\0${ids[0]}`)
          return `export const config = ${JSON.stringify({ shellOrigin, root: root.id, themeGlobal: root.themeGlobal ?? "theme" })};`;
        if (id === `\0${ids[1]}`) {
          const registry = await project.registry();
          return `export const entries = [${(registry.stories ?? [])
            .filter(entry => entry.root === root.id)
            .map(
              entry =>
                `({...${JSON.stringify(entry)}, load: () => import(${JSON.stringify(resolve(dir, entry.file))})})`
            )
            .join(",")}];`;
        }
        if (id === `\0${ids[2]}`)
          return `export { composeStories, setProjectAnnotations } from "@storybook/react-vite"; export { addons, mockChannel } from "storybook/preview-api"; export { within, userEvent } from "storybook/test";`;
        // Dynamic import keeps preview errors inside the host's import-stage reporter.
        if (id === `\0${ids[3]}`)
          return `export const loadPreview = () => import(${JSON.stringify(resolve(dir, root.preview))});`;
      },
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/__proto/story/")) return next();
          const main = fileURLToPath(new URL("../render/story-host.tsx", import.meta.url));
          res.setHeader("Content-Type", "text/html");
          res.end(
            await server.transformIndexHtml(
              req.url,
              `<html><body><div id="proto-story-canvas"></div><div id="proto-story-overlays"></div><script type="module" src="/@fs/${main}"></script></body></html>`
            )
          );
        });
      },
      handleHotUpdate({ server, modules, file }) {
        const patterns = typeof root.stories === "string" ? [root.stories] : root.stories;
        const authored =
          file === resolve(dir, root.preview) ||
          patterns.some(pattern => matchesGlob(file, resolve(dir, pattern)));
        if (!modules.length && !authored) return;
        for (const id of ids) {
          const module = server.moduleGraph.getModuleById(`\0${id}`);
          if (module) server.moduleGraph.invalidateModule(module);
        }
        server.ws.send({ type: "full-reload" });
        return [];
      },
    },
  ];
}
