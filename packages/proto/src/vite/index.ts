import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { loadProject, type ProtoProject } from "../node/project.ts";
import { productionBoundary } from "../node/production-boundary.ts";
import { presentationGuard } from "../node/presentation-guard.ts";
import { sourceTags } from "../node/source-tags.ts";
import type { RenderConfig } from "../model/render-host.ts";

export function proto(options: { config?: string } = {}): Plugin[] {
  let enabled = true;
  const boundary = productionBoundary();
  return [
    {
      ...boundary,
      async configResolved(config) {
        if (config.mode === "proto-render") {
          enabled = false;
          return;
        }
        const project = await loadProject(config.root, options.config);
        enabled = project.config.guards.productionBoundary;
      },
      generateBundle(options, bundle) {
        if (!enabled) return;
        const handler = boundary.generateBundle;
        if (typeof handler === "function") handler.call(this, options, bundle, false);
      },
    },
  ];
}
export function protoPresentation(
  options: { config?: string; sourceTags?: boolean } = {}
): Plugin[] {
  let guard: Plugin;
  let tags: Plugin;
  return [
    {
      name: "proto:presentation",
      enforce: "post",
      async configResolved(config) {
        const project = await loadProject(config.root, options.config);
        guard = presentationGuard(config.root, {
          matchers: project.config.guards.forbidRuntimeImports,
          modules: project.config.guards.forbidRuntimeImports.filter(
            (m): m is string => typeof m === "string" && m.startsWith("src/")
          ),
          packages: project.config.guards.forbidRuntimeImports.filter(
            (m): m is string => typeof m === "string" && !m.startsWith("src/")
          ),
        });
        tags = sourceTags(config.root, config.root);
        if (typeof guard.configResolved === "function")
          await guard.configResolved.call(this, config);
      },
      buildStart(options) {
        if (typeof guard?.buildStart === "function") return guard.buildStart.call(this, options);
      },
      async transform(code, id) {
        if (typeof guard?.transform === "function") return guard.transform.call(this, code, id);
      },
      buildEnd(error) {
        if (typeof guard?.buildEnd === "function") return guard.buildEnd.call(this, error);
      },
    },
    ...(options.sourceTags
      ? [
          {
            name: "proto:presentation-tags",
            enforce: "pre" as const,
            transform(code: string, id: string) {
              const hook = tags?.transform;
              if (hook && typeof hook !== "function") return hook.handler.call(this, code, id);
            },
          } satisfies Plugin,
        ]
      : []),
  ];
}
export function renderPlugins(project: ProtoProject, renderConfig: RenderConfig): Plugin[] {
  const ids = ["virtual:proto/render-config", "virtual:proto/prototypes", "virtual:proto/canvas"];
  return [
    sourceTags(project.root, project.root),
    ...protoPresentation(),
    {
      name: "proto:render",
      resolveId(id) {
        if (ids.includes(id)) return `\0${id}`;
      },
      async load(id) {
        if (id === `\0${ids[0]}`)
          return `export default ${JSON.stringify(renderConfig)}; export const config = ${JSON.stringify(renderConfig)}; export const renderConfig = config;`;
        if (id === `\0${ids[1]}`) {
          const registry = await project.registry();
          return `export const prototypes = [${registry.prototypes.map(p => `({...${JSON.stringify(p)}, load: () => import(${JSON.stringify(resolve(project.root, p.file))})})`).join(",")}]; export default prototypes;`;
        }
        if (id === `\0${ids[2]}`) {
          const canvas = resolve(project.root, project.config.canvas);
          return existsSync(canvas)
            ? `import * as canvas from ${JSON.stringify(canvas)}; export const Canvas = canvas.Canvas; export const Frame = canvas.Frame ?? null;`
            : "export const Canvas = ({children}) => children; export const Frame = null;";
        }
      },
      configureServer(server) {
        const stop = project.watch(() => {
          for (const id of ids) {
            const module = server.moduleGraph.getModuleById(`\0${id}`);
            if (module) server.moduleGraph.invalidateModule(module);
          }
          server.ws.send({ type: "full-reload" });
        });
        server.httpServer?.once("close", stop);
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/__proto/render/")) return next();
          const main = fileURLToPath(new URL("../render/main.tsx", import.meta.url));
          const html = `<html><body><div id="root"></div><script type="module" src="/@fs/${main}"></script></body></html>`;
          res.setHeader("Content-Type", "text/html");
          res.end(await server.transformIndexHtml(req.url, html));
        });
      },
    },
  ];
}
