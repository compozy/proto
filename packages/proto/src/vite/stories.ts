import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { resolve, matchesGlob, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import type { StoryRootConfig } from "../config.ts";
import type { ProtoProject } from "../node/project.ts";
import { presentationGuard } from "./index.ts";
/** Peers stay bare so the root optimizer owns their module instances. */
export function storyPlugins(
  project: ProtoProject,
  root: StoryRootConfig,
  shellOrigin: string
): Plugin[] {
  const dir = resolve(project.root, root.dir ?? ".");
  let snapshot: string | undefined;
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
          const entries = (registry.stories ?? []).filter(entry => entry.root === root.id);
          snapshot = JSON.stringify(entries);
          return `export const entries = [${entries
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
        const patterns = typeof root.stories === "string" ? [root.stories] : root.stories;
        const authored = (file: string) =>
          patterns.some(pattern => matchesGlob(file, resolve(dir, pattern)));
        const changed = (file: string) => {
          if (authored(file)) project.invalidateStories(root.id, [file]);
        };
        // Watch directories too: new files do not yet belong to Vite's module graph.
        server.watcher.add(dir);
        for (const event of ["add", "change", "unlink"] as const) server.watcher.on(event, changed);
        const stop = project.watch(registry => {
          const next = JSON.stringify(
            (registry.stories ?? []).filter(entry => entry.root === root.id)
          );
          if (snapshot === next) return;
          snapshot = next;
          const module = server.moduleGraph.getModuleById(`\0${ids[1]}`);
          if (module) server.moduleGraph.invalidateModule(module);
          server.ws.send({ type: "full-reload" });
        });
        server.httpServer?.once("close", () => {
          stop();
          for (const event of ["add", "change", "unlink"] as const)
            server.watcher.off(event, changed);
        });
        server.middlewares.use(async (req, res, next) => {
          if (req.method !== "GET" && req.method !== "HEAD") return next();
          let pathname: string;
          try {
            pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
          } catch {
            return next();
          }
          for (const mount of root.static ?? []) {
            const prefix = `/${mount.to.replace(/^\/+|\/+$/g, "")}`.replace(/\/$/, "");
            if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) continue;
            try {
              const base = await realpath(resolve(dir, mount.from));
              const file = await realpath(resolve(base, `.${pathname.slice(prefix.length)}`));
              if (!file.startsWith(`${base}${sep}`) || !(await stat(file)).isFile()) continue;
              const types: Record<string, string> = {
                ".js": "text/javascript",
                ".mjs": "text/javascript",
                ".css": "text/css",
                ".json": "application/json",
                ".html": "text/html",
                ".txt": "text/plain",
                ".svg": "image/svg+xml",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".gif": "image/gif",
                ".webp": "image/webp",
                ".ico": "image/x-icon",
                ".woff": "font/woff",
                ".woff2": "font/woff2",
                ".wasm": "application/wasm",
                ".mp4": "video/mp4",
              };
              res.setHeader("Content-Type", types[extname(file)] ?? "application/octet-stream");
              if (req.method === "HEAD") res.end();
              else {
                const stream = createReadStream(file);
                stream.on("error", next);
                res.on("close", () => stream.destroy());
                stream.pipe(res);
              }
              return;
            } catch (error) {
              if (!["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? ""))
                return next(error);
            }
          }
          next();
        });
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
    ...(root.guards?.forbidRuntimeImports?.length
      ? [
          presentationGuard(dir, {
            modules: [],
            packages: [],
            matchers: root.guards.forbidRuntimeImports,
          }),
        ]
      : []),
  ];
}
