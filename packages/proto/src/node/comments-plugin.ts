/** Legacy Vite host adapter; the review implementation is the shared fetch router. */
import type { Plugin } from "vite";
import { createReviewRouter, createDevAuthorizer, ReviewEvents } from "../review/index.ts";
import type { Registry } from "../model/registry.ts";
import { localStore } from "./comments-store.ts";
import { currentApp, repoRoot } from "./paths.ts";
import { findPrototypes } from "./discovery.ts";
import { findFlows } from "./flows.ts";
import { currentCommit } from "../store/file-store.ts";
export { createReviewRouter } from "../review/router.ts";
export function commentsApi(): Plugin {
  return {
    name: "proto:review",
    apply: "serve",
    configureServer(server) {
      const app = currentApp(),
        store = localStore(),
        events = new ReviewEvents();
      const registry = (): Registry => {
        const entries = findPrototypes(app.appRoot, repoRoot, app.config).entries;
        return {
          title: "Proto",
          locale: "en",
          specs: null,
          roles: {},
          siteUrl: null,
          problems: [],
          warnings: [],
          flows: findFlows(app.appRoot, repoRoot, entries, app.config).flows.map(flow => ({
            ...flow,
            file: flow.file,
            description: flow.description ?? null,
            spec: flow.spec ?? null,
            steps: flow.nodes.length,
          })),
          prototypes: entries
            .filter(entry => entry.meta)
            .map(entry => ({
              slug: entry.slug,
              kind: entry.kind,
              file: entry.file,
              title: entry.meta!.title,
              spec: entry.meta!.spec ?? null,
              surface: entry.meta!.surface ?? null,
              route: entry.meta!.route ?? null,
              blocks: [...(entry.meta!.blocks ?? [])],
              roles: [...(entry.meta!.roles ?? [])],
              standalone: entry.meta!.standalone ?? false,
              states: [...entry.meta!.states] as Registry["prototypes"][number]["states"],
            })),
        };
      };
      const port = server.config.server.port ?? 4400;
      const router = createReviewRouter({
        store,
        registry,
        events,
        authorize: createDevAuthorizer({ shellOrigin: `http://127.0.0.1:${port}` }),
        commit: () => currentCommit(app.appRoot),
      });
      const watching = store.subscribe(event => events.publish(event));
      server.httpServer?.once("close", () => {
        void watching.then(stop => stop());
      });
      server.middlewares.use((request, response, next) => {
        if (!request.url?.startsWith("/__proto/api/")) return next();
        void (async () => {
          const controller = new AbortController();
          response.once("close", () => controller.abort());
          const headers = new Headers();
          for (const [name, value] of Object.entries(request.headers))
            if (value !== undefined)
              headers.set(name, Array.isArray(value) ? value.join(", ") : value);
          const chunks: Uint8Array[] = [];
          let size = 0;
          for await (const chunk of request) {
            size += (chunk as Buffer).length;
            if (size > 5 * 1024 * 1024 + 65536) {
              response.writeHead(413);
              response.end();
              return;
            }
            chunks.push(chunk as Buffer);
          }
          const result = await router(
            new Request(`http://127.0.0.1:${port}${request.url}`, {
              method: request.method,
              headers,
              signal: controller.signal,
              ...(!["GET", "HEAD"].includes(request.method ?? "GET")
                ? { body: Buffer.concat(chunks) }
                : {}),
            })
          );
          response.writeHead(result.status, Object.fromEntries(result.headers));
          if (result.body) {
            const reader = result.body.getReader();
            try {
              while (true) {
                const part = await reader.read();
                if (part.done) break;
                response.write(part.value);
              }
            } finally {
              reader.releaseLock();
            }
          }
          response.end();
        })().catch(next);
      });
    },
  };
}
