import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
export const publicOrigin = "https://gallery.example.com",
  renderOrigin = "https://render.example.net";
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
  const credential = (await result.json()) as { token: string; credential: { id: string } };
  return {
    root,
    options,
    identities,
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
export async function httpContract(storage?: ReviewStorage) {
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
  return {
    store,
    async dispose() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(e => (e ? reject(e) : resolve())));
      await h.dispose();
    },
  };
}

/** Serve the fetch handler over real TLS for browser cookie-isolation tests. */
export async function browserServer(h: Awaited<ReturnType<typeof serverHarness>>) {
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
    "/CN=gallery.example.com",
  ]);
  const seen: { host: string; cookie: string }[] = [];
  const server = createServer(
    { key: await readFile(key), cert: await readFile(cert) },
    async (req, res) => {
      seen.push({ host: req.headers.host ?? "", cookie: req.headers.cookie ?? "" });
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = Buffer.concat(chunks);
      const response = await h.handler(
        new Request(`https://${req.headers.host}${req.url}`, {
          method: req.method,
          headers: req.headers as Record<string, string>,
          ...(body.length ? { body } : {}),
        })
      );
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    }
  );
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  h.options.publicOrigin = `https://gallery.example.com:${port}`;
  h.options.renderOrigin = `https://render.example.net:${port}`;
  h.rebuild();
  return {
    seen,
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(e => (e ? reject(e) : resolve())));
    },
  };
}
