import { createServer as createHttpServer, type ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Socket } from "node:net";
import { execFile, execFileSync } from "node:child_process";
import { createServer, type InlineConfig } from "vite";
import { validatePortRange } from "../config.ts";
import { hostAllowed, renderGuard } from "./render-guard.ts";
import { startStoryServer, projectId } from "./story-server.ts";
export { hostAllowed } from "./render-guard.ts";
import { ProtoError } from "../model/errors.ts";
import type { ProtoProject } from "./project.ts";
import { FileStore, currentCommit } from "../store/index.ts";
import { createReviewRouter, createDevAuthorizer, ReviewEvents } from "../review/index.ts";
import { sourceRoots } from "../model/source.ts";
import { renderPlugins } from "../vite/index.ts";

export type ReviewHandler = (request: Request) => Promise<Response>;
export type DevOptions = {
  storyRoots?: "all" | "none" | readonly string[];
  quiet?: boolean;
  open?: boolean;
  port?: number;
  review?: ReviewHandler;
  shellDir?: string;
};
export function commitAt(root: string): string | null {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}
/** Configure the consumer render server on the adjacent loopback port with the project watch policy. */
export function renderViteConfig(project: ProtoProject, port: number): InlineConfig {
  return {
    root: project.root,
    mode: "proto-render",
    plugins: renderPlugins(project, {
      mode: "dev",
      shellOrigin: `http://127.0.0.1:${port}`,
      form: "path",
    }),
    server: {
      host: "127.0.0.1",
      port: port + 1,
      strictPort: true,
      allowedHosts: [...project.config.dev.allowedHosts],
      // Match the registry watcher's macOS fallback: both metadata and component bodies must
      // update in managed filesystems where native filesystem notifications can be missed.
      watch: { usePolling: project.config.dev.poll || process.platform === "darwin" },
    },
  };
}
/** Start review/SSE and render servers after the review baseline is ready; close both on shutdown. */
export async function startDev(project: ProtoProject, options: DevOptions = {}) {
  const port = options.port ?? project.config.dev.port;
  const roots = project.config.stories?.roots ?? [];
  validatePortRange(port, roots.length);
  if (
    Array.isArray(options.storyRoots) &&
    options.storyRoots.some(id => !roots.some(root => root.id === id))
  )
    throw new ProtoError("invalid_input", "Unknown story root");
  const selected = roots.flatMap((root, index) =>
    options.storyRoots === "none" ||
    (Array.isArray(options.storyRoots) && !options.storyRoots.includes(root.id))
      ? []
      : [{ root, port: port + 2 + index }]
  );
  const storyServers: Awaited<ReturnType<typeof startStoryServer>>[] = [];
  const storyRoots = selected.map(({ root, port }) => ({
    id: root.id,
    renderUrl: `http://127.0.0.1:${port}/__proto/story/`,
  }));
  const origin = `http://127.0.0.1:${port}`;
  const clients = new Set<ServerResponse>();
  // HTTP idle cleanup does not include TCP preconnects that have not sent a request yet.
  const preconnects = new Set<Socket>();
  let closing = false;
  let registryWatcherReady = false;
  const publish = (event: "registry" | "comments" | "review", data: unknown) => {
    for (const client of clients)
      client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  let review = options.review;
  const mountReview = (handler: ReviewHandler) => {
    review = handler;
  };
  const events = new ReviewEvents();
  const stopEvents = events.subscribe(event => {
    if (event.type === "comments" || event.type === "review")
      publish(event.type, { key: event.key });
  });
  const store = options.review ? null : project.store();
  if (store)
    mountReview(
      createReviewRouter({
        store,
        registry: () => project.registry(),
        events,
        authorize: createDevAuthorizer({
          shellOrigin: origin,
          allowedHosts: project.config.dev.allowedHosts,
        }),
        roots: sourceRoots(project.config),
        commit: () => currentCommit(project.root),
      })
    );
  let stopReviews = () => {};

  const shellDir = options.shellDir ?? fileURLToPath(new URL("../../dist/shell/", import.meta.url));
  const server = createHttpServer(async (req, res) => {
    preconnects.delete(req.socket);
    if (!hostAllowed(req.headers.host, port, project.config.dev.allowedHosts)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { code: "host_not_allowed", message: "Host not allowed" } }));
      return;
    }
    if (req.headers.host === `localhost:${port}`) {
      res.writeHead(302, { Location: `${origin}${req.url}` });
      res.end();
      return;
    }
    try {
      const url = new URL(req.url ?? "/", origin);
      if (url.pathname === "/__proto/api/events") {
        if (closing) {
          res.writeHead(503, { Connection: "close" });
          res.end();
          return;
        }
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        res.write(": connected\n\n");
        if (registryWatcherReady) res.write(": registry-watcher-ready\n\n");
        clients.add(res);
        req.once("close", () => clients.delete(res));
        return;
      }
      let response: Response;
      if (url.pathname === "/__proto/bootstrap.json")
        response = Response.json({
          mode: "dev",
          projectId: projectId(project.root),
          ...(project.config.stories ? { storyRoots } : {}),
          title: project.config.title,
          locale: project.config.locale,
          commit: commitAt(project.root),
          apiBase: "/__proto/api/",
          eventsUrl: "/__proto/api/events",
          renderUrl: `http://127.0.0.1:${port + 1}/__proto/render/`,
          registryUrl: "/__proto/api/registry",
          reviewSnapshotBase: null,
          principal: null,
          signInUrl: null,
        });
      else if (url.pathname === "/__proto/api/registry")
        response = Response.json(await project.registry());
      else if (url.pathname.startsWith("/__proto/api/") && review) {
        const chunks: Buffer[] = [];
        let bytes = 0;
        for await (const chunk of req) {
          bytes += (chunk as Buffer).length;
          if (bytes > 5 * 1024 * 1024 + 65536) {
            res.writeHead(413, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error: { code: "attachment_too_large", message: "Images are limited to 5 MB." },
              })
            );
            return;
          }
          chunks.push(Buffer.from(chunk));
        }
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers))
          if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
        response = await review(
          new Request(url, {
            method: req.method,
            headers,
            ...(!["GET", "HEAD"].includes(req.method ?? "GET")
              ? { body: Buffer.concat(chunks) }
              : {}),
          })
        );
      } else if (url.pathname.startsWith("/__proto/api/"))
        response = new Response("Not found", { status: 404 });
      else {
        const candidate = resolve(shellDir, `.${decodeURIComponent(url.pathname)}`);
        const file =
          candidate.startsWith(resolve(shellDir) + sep) &&
          existsSync(candidate) &&
          extname(candidate)
            ? candidate
            : resolve(shellDir, "index.html");
        const types: Record<string, string> = {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".svg": "image/svg+xml",
        };
        response = existsSync(file)
          ? new Response(readFileSync(file), {
              headers: { "Content-Type": types[extname(file)] ?? "application/octet-stream" },
            })
          : new Response(
              "<h1>Proto shell is not built</h1><p>Run the shell build to create packages/proto/dist/shell/.</p>",
              { headers: { "Content-Type": "text/html" }, status: 503 }
            );
      }
      if (response.headers.get("Content-Type")?.includes("text/html"))
        response.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      res.writeHead(500);
      res.end(String(error));
    }
  });
  server.on("connection", socket => {
    if (closing) {
      socket.destroy();
      return;
    }
    preconnects.add(socket);
    socket.once("close", () => preconnects.delete(socket));
  });
  const vite = await createServer({
    ...renderViteConfig(project, port),
    ...(options.quiet ? { logLevel: "silent" as const } : {}),
  });
  // Prepend to the Vite stack so its own host handling cannot bypass the exact port check.
  vite.middlewares.stack.unshift(renderGuard(port + 1, origin, project.config.dev.allowedHosts));
  /** Stop admission and bound SSE/HTTP draining while accepted requests have time to finish. */
  const closeServers = async () => {
    closing = true;
    const closed = new Promise<void>(resolve => server.close(() => resolve()));
    for (const socket of preconnects) socket.destroy();
    const streamsEnded = Promise.all(
      [...clients].map(
        client =>
          new Promise<void>(resolve => {
            if (client.destroyed || client.writableFinished) {
              resolve();
              return;
            }
            const deadline = setTimeout(() => client.destroy(), 1000);
            const finish = () => {
              clearTimeout(deadline);
              client.off("finish", finish);
              client.off("close", finish);
              resolve();
            };
            client.once("finish", finish);
            client.once("close", finish);
            client.end();
          })
      )
    ).then(() => server.closeIdleConnections());
    const requestDeadline = setTimeout(() => server.closeAllConnections(), 10_000);
    try {
      await Promise.all([
        vite.close(),
        ...storyServers.map(server => server.close()),
        streamsEnded,
        closed,
      ]);
    } finally {
      clearTimeout(requestDeadline);
    }
  };
  try {
    // Capture the review baseline before clients can read data or connect to SSE.
    if (store instanceof FileStore)
      stopReviews = await store.subscribe(event => events.publish(event));
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", resolve);
    });
    await vite.listen();
    for (const { root, port: storyPort } of selected) {
      storyServers.push(
        await startStoryServer(project, root, { shell: port, story: storyPort }, options.quiet)
      );
      if (!options.quiet) {
        const registry = await project.registry();
        const files = (registry.stories ?? []).filter(file => file.root === root.id);
        const count = files.reduce((sum, file) => sum + file.stories.length, 0);
        console.log(
          `stories ${root.id} http://127.0.0.1:${storyPort}  ${files.length} files, ${count} stories`
        );
        for (const warning of registry.warnings.filter(warning => warning.root === root.id))
          console.warn(`warning ${warning.code} ${root.id}: ${warning.message}`);
      }
    }
  } catch (error) {
    stopReviews();
    stopEvents();
    await closeServers();
    if (error instanceof ProtoError) throw error;
    if (String(error).includes("in use") || (error as NodeJS.ErrnoException).code === "EADDRINUSE")
      throw new ProtoError(
        "port_in_use",
        `Ports ${port} and ${port + 1}${roots.length ? ` through ${port + 1 + roots.length}` : ""} must be available: ${String(error)}`
      );
    throw error;
  }
  if (options.open) {
    const command =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
          ? "explorer.exe"
          : "xdg-open";
    execFile(command, [origin], error => {
      if (error && !options.quiet) console.warn("Could not open the browser; visit " + origin);
    });
  }
  const stop = project.watch(() => publish("registry", { revision: project.revision }));
  registryWatcherReady = true;
  for (const client of clients) client.write(": registry-watcher-ready\n\n");
  return {
    origin,
    storyRoots,
    renderOrigin: `http://127.0.0.1:${port + 1}`,
    publish,
    mountReview,
    async close() {
      stop();
      stopReviews();
      stopEvents();
      await closeServers();
    },
  };
}
