import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Plugin } from "vite";

import { findPrototypes } from "../discovery.ts";
import { findFlows } from "../flows.ts";
import type { GalleryApp } from "../paths.ts";

/**
 * `virtual:gallery-prototypes`: discovered prototypes (lazy loaders), flows and problems.
 * `virtual:gallery-app`: the app's config and its presentation wiring (`preview/canvas.tsx`
 * exports `PresentationCanvas` and `PrototypeFrame`; `preview/gallery.css` is the stylesheet).
 */
export function prototypeRegistry(app: GalleryApp, repoRoot: string): Plugin {
  const registry = "virtual:gallery-prototypes";
  const appModule = "virtual:gallery-app";
  const ids: Record<string, string> = {
    [registry]: `\0${registry}`,
    [appModule]: `\0${appModule}`,
  };
  const { appRoot, config } = app;
  let building = false;
  const canvas = join(appRoot, "preview/canvas.tsx");
  const styles = join(appRoot, "preview/gallery.css");
  return {
    name: "gallery:prototypes",
    config() {
      // macOS native watchers can register paths without delivering events in managed hosts.
      // Use Chokidar's supported polling backend so gallery discovery sees new files too.
      if (process.platform === "darwin") return { server: { watch: { usePolling: true } } };
    },
    configResolved(resolved) {
      building = resolved.command === "build";
    },
    resolveId(source) {
      return ids[source];
    },
    load(source) {
      if (source === ids[appModule]) {
        for (const file of [canvas, styles])
          if (!existsSync(file)) this.error(`Missing ${file}: see packages/proto/CLAUDE.md`);
        return `import ${JSON.stringify(styles)};
export { PresentationCanvas, PrototypeFrame } from ${JSON.stringify(canvas)};
export const config = ${JSON.stringify(config)};`;
      }
      if (source !== ids[registry]) return;
      const result = findPrototypes(appRoot, repoRoot, config);
      const flows = findFlows(appRoot, repoRoot, result.entries, config);
      return `export const problems = ${JSON.stringify(result.problems)};
export const flows = ${JSON.stringify(flows.flows)};
export const flowProblems = ${JSON.stringify(flows.problems)};
export const flowWarnings = ${JSON.stringify(flows.warnings)};
export const prototypes = [${result.entries.map(entry => `{...${JSON.stringify(entry)}, load: () => import(${JSON.stringify(resolve(repoRoot, entry.file))})}`).join(",")}];`;
    },
    buildStart() {
      const result = findPrototypes(appRoot, repoRoot, config);
      const flows = findFlows(appRoot, repoRoot, result.entries, config);
      const problems = [...result.problems, ...flows.problems];
      if (building && problems.length)
        this.error(problems.map(problem => `${problem.file}: ${problem.message}`).join("\n"));
    },
    configureServer(server) {
      // Prototypes live outside the gallery root, including files not imported yet.
      server.watcher.add(appRoot);
      const refresh = (path: string) => {
        if (!path.endsWith(".proto.tsx") && !path.endsWith(".flow.ts")) return;
        const module = server.moduleGraph.getModuleById(ids[registry]!);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("add", refresh).on("unlink", refresh).on("change", refresh);
    },
  };
}
