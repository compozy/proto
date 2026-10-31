/**
 * Shell harness (dev only, never shipped): `bun run dev:shell` serves the shell source with
 * fixture `bootstrap.json`, registry and SSE on http://127.0.0.1:4430, and the fake render host
 * (`render.html`) on :4431 — a real second origin, as in `proto dev`.
 *
 *   HARNESS_MODE=dev|read-only|remote  HARNESS_FIXTURE=full|empty  HARNESS_LOCALE=en|pt-BR
 *   GET /__harness/registry-event      pushes an SSE `registry` event (the shell refetches)
 */
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";

import { bootstrapFor, emptyRegistry, registry } from "./fixtures.ts";

const port = Number(process.env.HARNESS_PORT ?? 4430);
const renderPort = port + 1;
const mode = (process.env.HARNESS_MODE ?? "dev") as "dev" | "read-only" | "remote";
const locale = (process.env.HARNESS_LOCALE ?? "en") as "en" | "pt-BR";
const fixture = process.env.HARNESS_FIXTURE === "empty" ? emptyRegistry : registry;
const shell = fileURLToPath(new URL("../../src/shell/", import.meta.url));
const renderPage = fileURLToPath(new URL("./render.html", import.meta.url));

function json(response: ServerResponse, body: unknown) {
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(body));
}

function harness(): Plugin {
  const streams = new Set<ServerResponse>();
  return {
    name: "proto-shell-harness",
    configureServer(server) {
      const render = createServer((request, response) => {
        if (!request.url?.startsWith("/__proto/render/")) {
          response.statusCode = 404;
          response.end();
          return;
        }
        response.setHeader("content-type", "text/html");
        response.end(readFileSync(renderPage));
      });
      render.listen(renderPort, "127.0.0.1");
      server.httpServer?.on("close", () => render.close());
      server.middlewares.use((request, response, next) => {
        const path = request.url?.split("?")[0];
        if (path === "/__proto/bootstrap.json") {
          return json(
            response,
            bootstrapFor({
              mode,
              locale,
              renderUrl: `http://127.0.0.1:${renderPort}/__proto/render/`,
            })
          );
        }
        if (path === "/__proto/api/registry" || path === "/__proto/registry.json") {
          return json(response, fixture);
        }
        if (path === "/__proto/api/events") {
          response.writeHead(200, {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
            connection: "keep-alive",
          });
          response.write(": connected\n\n");
          streams.add(response);
          request.on("close", () => streams.delete(response));
          return;
        }
        if (path === "/__harness/registry-event") {
          for (const stream of streams) stream.write("event: registry\ndata: {}\n\n");
          return json(response, { sent: streams.size });
        }
        next();
      });
    },
  };
}

export default defineConfig({
  root: shell,
  plugins: [
    harness(),
    tailwindcss(),
    react({ compiler: { panicThreshold: "all_errors", sources: [shell] } }),
  ],
  server: { host: "127.0.0.1", port, strictPort: true },
});
