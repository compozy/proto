import { HttpStore } from "../../../src/store/http-store.ts";
import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, rm, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  createReviewServer,
  fileStorage,
  type Identity,
  type ReviewStorage,
  type ReviewServerOptions,
  type ReviewStore,
} from "../../../src/server/index.ts";
import { ProtoError, type ErrorCode } from "../../../src/model/errors.ts";
import type { Author } from "../../../src/model/review.ts";
// Chromium resolves these hosts to loopback without resolver flags. tldts treats
// them as distinct registrable domains, preserving the production same-site guard.
export const publicOrigin = "https://gallery.localhost",
  renderOrigin = "https://render.localhost";
export async function serverHarness(storage?: ReviewStorage) {
  const root = await mkdtemp(join(tmpdir(), "proto-server-"));
  await mkdir(join(root, "gallery/__proto/render/assets"), { recursive: true });
  const registry = {
    title: "Test",
    locale: "en",
    specs: { auth: "Auth" },
    roles: {},
    siteUrl: null,
    problems: [],
    warnings: [],
    flows: [{ id: "sign-in", spec: "auth" }],
    prototypes: ["login-form", "second"].map(slug => ({
      slug,
      title: slug,
      kind: "component",
      file: `src/${slug}.proto.tsx`,
      spec: "auth",
      surface: null,
      route: null,
      blocks: [],
      roles: [],
      standalone: false,
      states: [{ id: "default", label: "Default" }],
    })),
  };
  await writeFile(join(root, "gallery/__proto/registry.json"), JSON.stringify(registry));
  await writeFile(
    join(root, "gallery/__proto/bootstrap.json"),
    JSON.stringify({
      mode: "read-only",
      title: "Test",
      locale: "en",
      commit: "a".repeat(40),
      apiBase: null,
      eventsUrl: null,
      renderUrl: "__proto/render/index.html",
      registryUrl: "__proto/registry.json",
      reviewSnapshotBase: null,
      principal: null,
      signInUrl: null,
    })
  );
  await writeFile(join(root, "gallery/index.html"), "<!doctype html><title>Built gallery</title>");
  await writeFile(
    join(root, "gallery/__proto/render/index.html"),
    '<!doctype html><script src="/ __proto/render/assets/app.js"></script>'
  );
  await writeFile(
    join(root, "gallery/__proto/render/assets/app.js"),
    "window.renderLoaded = true;"
  );
  const identities = new Map<string, Identity>([
    ["review", { id: "review-id", name: "Same Name", scopes: ["review", "comment"] }],
    ["comment", { id: "comment-id", name: "Same Name", scopes: ["comment"] }],
    ["agent", { id: "agent-id", name: "Pedro Nauck", scopes: ["comment"] }],
  ]);
  const options: ReviewServerOptions = {
    storage: storage ?? fileStorage(join(root, "reviews")),
    gallery: { dir: join(root, "gallery") },
    publicOrigin,
    renderOrigin,
    basePath: "/proto/",
    ticketSecret: "s".repeat(32),
    authorize: async request =>
      identities.get(request.headers.get("cookie")?.match(/session=([^;]+)/)?.[1] ?? "") ?? null,
    credentialOwner: async id => [...identities.values()].find(value => value.id === id) ?? null,
    signIn: { url: "/login" },
    log: () => {},
  };
  let handler = createReviewServer(options);
  const request = (
    path: string,
    method = "GET",
    body?: unknown,
    who = "review",
    extra: Record<string, string> = {}
  ) =>
    handler(
      new Request(path.startsWith("http") ? path : `${publicOrigin}/proto/${path}`, {
        method,
        headers: {
          ...(who ? { cookie: `session=${who}` } : {}),
          origin: publicOrigin,
          "x-proto-request": "1",
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...extra,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    );
  const result = await request("api/credentials", "POST", { name: "codex-ci" }, "agent");
  const credential = (await result.json()) as {
    token: string;
    credential: { id: string; scopes: string[] };
  };
  return {
    root,
    options,
    identities,
    async retireKey() {
      registry.prototypes = [];
      await writeFile(join(root, "gallery/__proto/registry.json"), JSON.stringify(registry));
    },
    request,
    credential,
    handler: (request: Request) => handler(request),
    rebuild() {
      handler = createReviewServer(options);
    },
    dispose: () => rm(root, { recursive: true, force: true }),
  };
}
/** Real HTTP transport adapter used only to run the existing contract; no storage is mocked. */
export async function httpContract(storage?: ReviewStorage, useHttpStore = false) {
  const h = await serverHarness(storage);
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks);
    const response = await h.handler(
      new Request(`${h.options.publicOrigin}${req.url}`, {
        method: req.method,
        headers: req.headers as Record<string, string>,
        ...(body.length ? { body } : {}),
      })
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  h.options.publicOrigin = `http://127.0.0.1:${address.port}`;
  h.rebuild();
  async function call(
    path: string,
    method = "GET",
    data?: unknown,
    author?: Author,
    form?: FormData
  ) {
    const response = await fetch(`http://127.0.0.1:${address.port}/proto/api/${path}`, {
      method,
      headers: {
        ...(author?.kind === "agent"
          ? { authorization: `Bearer ${h.credential.token}` }
          : { cookie: "session=review", origin: h.options.publicOrigin, "x-proto-request": "1" }),
        ...(data === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(form || data !== undefined ? { body: form ?? JSON.stringify(data) } : {}),
    });
    if (!response.ok) {
      const value = (await response.json()) as { error: { code: ErrorCode; message: string } };
      throw new ProtoError(value.error.code, value.error.message);
    }
    return response;
  }
  async function json(path: string, method?: string, data?: unknown, author?: Author) {
    return (await call(path, method, data, author)).json();
  }
  const store: ReviewStore = {
    async list(filter = {}) {
      return (
        await json(
          `comments?${new URLSearchParams(Object.entries(filter).map(([k, v]) => [k, String(v)]))}`
        )
      ).comments;
    },
    async get(id) {
      return (await json(`comments/${id}`)).comment;
    },
    async add(key, input, author) {
      return (await json("comments", "POST", { ...input, key }, author)).comment;
    },
    async reply(id, input, author) {
      return (await json(`comments/${id}/replies`, "POST", input, author)).comment;
    },
    async setStatus(id, status, author, note) {
      return (await json(`comments/${id}/status`, "PATCH", { status, note }, author)).comment;
    },
    async editMessage(id, messageId, change, author) {
      return (await json(`comments/${id}/messages/${messageId}`, "PATCH", change, author)).comment;
    },
    async remove(id, author) {
      await call(`comments/${id}`, "DELETE", undefined, author);
    },
    async upload(key, file, author) {
      const form = new FormData();
      form.set(
        "file",
        new Blob([new Uint8Array(file.bytes)], { type: file.type ?? "image/png" }),
        file.name
      );
      return (await (await call(`attachments?key=${key}`, "POST", undefined, author, form)).json())
        .attachment;
    },
    async discard(key, id, author) {
      await call(`attachments/${key}/${id}`, "DELETE", undefined, author);
    },
    async readAttachment(key, id) {
      const response = await call(`attachments/${key}/${id}`);
      return {
        bytes: new Uint8Array(await response.arrayBuffer()),
        type: response.headers.get("content-type")!,
        name: "shot.png",
      };
    },
    async review(key) {
      return (await json(`reviews/${key}`)).review;
    },
    async transition(key, to, author, options) {
      return (
        await json(
          `reviews/${key}/transitions`,
          "POST",
          { to, confirmOpen: options.confirmOpen },
          author
        )
      ).review;
    },
    async unlock() {
      throw new ProtoError("scope_denied");
    },
  };
  const client = new HttpStore({
    url: `${h.options.publicOrigin}/proto/`,
    token: h.credential.token,
  });
  const contractStore = useHttpStore
    ? new Proxy(store, {
        get(target, property) {
          const name = property as keyof ReviewStore;
          if (["list", "get", "review", "readAttachment"].includes(name))
            return (client[name] as Function).bind(client);
          return (...args: unknown[]) => {
            const isAgent = args.some(
              arg => arg && typeof arg === "object" && "kind" in arg && arg.kind === "agent"
            );
            const chosen = isAgent ? client : target;
            return (chosen[name] as Function).apply(chosen, args);
          };
        },
      })
    : store;
  return {
    store: contractStore,
    retireKey: h.retireKey,
    client,
    harness: h,
    async dispose() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(e => (e ? reject(e) : resolve())));
      await h.dispose();
    },
  };
}

/** Serve the fetch handler over real TLS for browser cookie-isolation tests. */
export async function browserServer(
  h: Awaited<ReturnType<typeof serverHarness>>,
  dispatch?: (request: Request) => Promise<Response>
) {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { readFile } = await import("node:fs/promises");
  const { createServer } = await import("node:https");
  const key = join(h.root, "test.key"),
    cert = join(h.root, "test.crt");
  await promisify(execFile)("openssl", [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    key,
    "-out",
    cert,
    "-days",
    "1",
    "-subj",
    "/CN=gallery.localhost",
  ]);
  const seen: { host: string; cookie: string }[] = [];
  const server = createServer(
    { key: await readFile(key), cert: await readFile(cert) },
    async (req, res) => {
      try {
        seen.push({ host: req.headers.host ?? "", cookie: req.headers.cookie ?? "" });
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const body = Buffer.concat(chunks);
        const response = await (dispatch ?? h.handler)(
          new Request(`https://${req.headers.host}${req.url}`, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            ...(body.length ? { body } : {}),
          })
        );
        res.writeHead(response.status, Object.fromEntries(response.headers));
        if (response.headers.get("content-type")?.includes("text/event-stream")) {
          res.flushHeaders();
          const reader = response.body!.getReader();
          res.once("close", () => {
            void reader.cancel();
          });
          for (;;) {
            const chunk = await reader.read();
            if (chunk.done) break;
            res.write(Buffer.from(chunk.value));
          }
          res.end();
        } else res.end(Buffer.from(await response.arrayBuffer()));
      } catch (error) {
        // An upstream Vite/dispatch failure must end the HTTP request, not hang navigation.
        if (!res.headersSent) res.writeHead(502, { "Content-Type": "text/plain" });
        res.end(
          "Test upstream failed: " + (error instanceof Error ? error.message : String(error))
        );
      }
    }
  );
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  h.options.publicOrigin = `https://gallery.localhost:${port}`;
  h.options.renderOrigin = `https://render.localhost:${port}`;
  h.rebuild();
  return {
    seen,
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(e => (e ? reject(e) : resolve())));
    },
  };
}

/** Real package build output used by deployed-browser tests, including a hostile draft. */
export async function buildRemoteGallery(h: Awaited<ReturnType<typeof serverHarness>>) {
  const { loadProject } = await import("../../../src/node/project.ts");
  const { buildProject } = await import("../../../src/node/build.ts");
  const base = resolve(import.meta.dirname, "../../../.tmp");
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(join(base, "remote-gallery-"));
  try {
    await mkdir(join(root, "src/drafts/login-form"), { recursive: true });
    await writeFile(
      join(root, "proto.config.ts"),
      `export default {title:"Remote fixture",review:{remote:{url:${JSON.stringify(h.options.publicOrigin + "/proto/")}}}};`
    );
    await writeFile(
      join(root, "vite.config.ts"),
      `import react from '@vitejs/plugin-react'; export default {cacheDir:'.vite',plugins:[react()]};`
    );
    await writeFile(
      join(root, "proto.canvas.tsx"),
      `export function Canvas({children}){return children}`
    );
    await writeFile(
      join(root, "src/drafts/login-form/index.proto.tsx"),
      `import {definePrototype} from '@compozy/proto';
      export const meta=definePrototype({title:'Login form',states:[{id:'default',label:'Default'}]});
      export default function View(){ return <main><button data-testid="remote-pick">Review target</button><output data-testid="hostile-cookie">{document.cookie || 'empty'}</output></main> }`
    );
    const result = await buildProject(await loadProject(root), { remote: h.options.publicOrigin });
    await cp(result.output, h.options.gallery.dir, { recursive: true });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

export { chromium } from "playwright";
export { build as buildViteApp, preview as previewViteApp } from "vite";
