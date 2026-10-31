import { randomBytes } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { getDomain } from "tldts";
import { z } from "zod";
import { protocolVersion } from "../model/protocol.ts";
import { bootstrapSchema } from "../model/bootstrap.ts";
import type { Registry } from "../model/registry.ts";
import { errorBody, ProtoError } from "../model/errors.ts";
import { createReviewRouter } from "../review/router.ts";
import { ReviewEvents } from "../review/events.ts";
import { createRemoteAuthorizer, credentialHash } from "./auth.ts";
import { signGrant, readGrant } from "./tickets.ts";
import type { ReviewServerOptions, Principal } from "./types.ts";
const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};
const safeReturn = (path: string | null, base: string) =>
  path?.startsWith("/") && !path.startsWith("//") && !/[\\\r\n]/.test(path) ? path : base;
export function createReviewServer(
  options: ReviewServerOptions
): (request: Request) => Promise<Response> {
  const publicUrl = new URL(options.publicOrigin),
    renderUrl = new URL(options.renderOrigin);
  if (
    publicUrl.origin !== options.publicOrigin ||
    renderUrl.origin !== options.renderOrigin ||
    ![publicUrl, renderUrl].every(url => ["https:", "http:"].includes(url.protocol))
  )
    throw new Error("Expected canonical HTTP origins.");
  const site = (url: URL) => getDomain(url.hostname, { allowPrivateDomains: true }) ?? url.hostname;
  if (
    publicUrl.host === renderUrl.host ||
    (!options.allowSameSiteRender && site(publicUrl) === site(renderUrl))
  )
    throw new Error(
      "renderOrigin must use a different registrable domain; allowSameSiteRender acknowledges cookie isolation responsibility."
    );
  if (Buffer.byteLength(options.ticketSecret) < 32)
    throw new Error("ticketSecret must contain at least 32 bytes.");
  const base = options.basePath ?? "/";
  if (
    !base.startsWith("/") ||
    !base.endsWith("/") ||
    base.includes("..") ||
    base.includes("\\") ||
    base.startsWith("//")
  )
    throw new Error("basePath must be an origin-relative directory.");
  const api = `${base}api/`,
    now = options.clock ?? Date.now;
  const events = new ReviewEvents(),
    auth = createRemoteAuthorizer(options);
  const root = resolve(options.gallery.dir);
  const registry = async () =>
    JSON.parse(await readFile(resolve(root, "__proto/registry.json"), "utf8")) as Registry;
  const builtBootstrap = async () =>
    bootstrapSchema.parse(
      JSON.parse(await readFile(resolve(root, "__proto/bootstrap.json"), "utf8"))
    );
  const commit = async () => (await builtBootstrap()).commit;
  options.storage.configure(registry, commit);
  const router = createReviewRouter({
    store: options.storage.store,
    registry,
    commit,
    events,
    basePath: api.slice(0, -1),
    authorize: auth.authorize,
  });
  function signInUrl(path: string) {
    return `${base}sign-in?returnTo=${encodeURIComponent(safeReturn(path, base))}`;
  }
  async function asset(request: Request, relative: string, render = false) {
    if (!["GET", "HEAD"].includes(request.method)) return new Response(null, { status: 405 });
    try {
      const decoded = decodeURIComponent(relative);
      if (!render && decoded.startsWith("__proto/render/"))
        return new Response(null, { status: 404 });
      if (decoded.split("/").some(part => part.startsWith(".") || part === "review"))
        return new Response(null, { status: 404 });
      const file = await realpath(resolve(root, decoded));
      const allowedRoot = await realpath(render ? resolve(root, "__proto/render") : root);
      if (!file.startsWith(`${allowedRoot}${sep}`)) return new Response(null, { status: 404 });
      const bytes = await readFile(file);
      return new Response(request.method === "HEAD" ? null : bytes, {
        headers: {
          "Content-Type": types[extname(file)] ?? "application/octet-stream",
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, no-store",
        },
      });
    } catch {
      return new Response(null, { status: 404 });
    }
  }
  async function dispatch(
    request: Request,
    remember: (value: Principal | null) => void
  ): Promise<Response> {
    await options.storage.checkSchema();
    const url = new URL(request.url),
      host = request.headers.get("host") ?? url.host;
    if (![publicUrl.host, renderUrl.host].includes(host) || url.host !== host)
      throw new ProtoError("host_not_allowed");
    if (host === renderUrl.host) {
      const ticket = readGrant(
        url.searchParams.get("ticket"),
        "ticket",
        options.renderOrigin,
        options.ticketSecret,
        now()
      );
      if (ticket) {
        const grant = signGrant(
          { ...ticket, kind: "grant", expires: now() + 3600000 },
          options.ticketSecret
        );
        url.searchParams.delete("ticket");
        return new Response(null, {
          status: 302,
          headers: {
            Location: url.toString(),
            "Set-Cookie": `__Host-proto-render=${grant}; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=3600`,
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
          },
        });
      }
      const cookie =
        request.headers
          .get("cookie")
          ?.split(";")
          .map(c => c.trim())
          .find(c => c.startsWith("__Host-proto-render="))
          ?.slice("__Host-proto-render=".length) ?? null;
      if (!readGrant(cookie, "grant", options.renderOrigin, options.ticketSecret, now())) {
        // No application bundle is served before a grant. This tiny page also handles initial expiry.
        const origin = JSON.stringify(options.publicOrigin).replaceAll("<", "\\u003c");
        return new Response(
          request.method === "HEAD"
            ? null
            : `<!doctype html><script>parent.postMessage({proto:${protocolVersion},frame:new URL(location.href).searchParams.get("frame"),type:"auth:expired"},${origin})</script>`,
          {
            status: 401,
            headers: {
              "Content-Type": "text/html",
              "Cache-Control": "no-store",
              "Referrer-Policy": "no-referrer",
            },
          }
        );
      }
      if (!url.pathname.startsWith("/__proto/render/")) return new Response(null, { status: 404 });
      const relative = url.pathname.slice(1);
      return asset(request, extname(relative) ? relative : "__proto/render/index.html", true);
    }
    if (!url.pathname.startsWith(base)) return new Response(null, { status: 404 });
    if (url.pathname === `${base}sign-in` && request.method === "GET") {
      const returnTo = safeReturn(url.searchParams.get("returnTo"), base);
      if (typeof options.signIn === "function") return options.signIn(request, returnTo);
      const destination = new URL(options.signIn.url, options.publicOrigin);
      destination.searchParams.set("returnTo", returnTo);
      return Response.redirect(destination, 302);
    }
    const principal = await auth.principal(request);
    remember(principal);
    if (
      url.pathname === `${base}__proto/bootstrap.json` ||
      url.pathname === `${base}bootstrap.json`
    ) {
      if (request.method !== "GET") return new Response(null, { status: 405 });
      return Response.json(
        {
          ...(await builtBootstrap()),
          mode: "remote",
          apiBase: api,
          eventsUrl: `${api}events`,
          registryUrl: `${api}registry`,
          renderUrl: `${options.renderOrigin}/__proto/render/`,
          reviewSnapshotBase: null,
          principal,
          signInUrl: signInUrl(base),
        },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }
    if (!principal) {
      const destination = signInUrl(url.pathname + url.search);
      if (url.pathname.startsWith(api))
        throw new ProtoError("auth_required", undefined, { signInUrl: destination });
      return new Response(null, {
        status: 302,
        headers: { Location: destination, "Cache-Control": "no-store" },
      });
    }
    if (url.pathname.startsWith(api)) {
      await auth.requirePrincipal(request);
      const path = url.pathname.slice(api.length);
      if (path === "session" && request.method === "GET") {
        const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
        const credential =
          principal.kind === "agent" && token
            ? await options.storage.credentials.find(credentialHash(token))
            : null;
        return Response.json({
          principal,
          ...(credential
            ? {
                credential: { id: credential.id, name: credential.name, scopes: credential.scopes },
              }
            : {}),
        });
      }
      if (path === "render-ticket" && request.method === "GET") {
        if (principal.kind !== "reviewer") throw new ProtoError("scope_denied");
        const slug = z
          .string()
          .regex(/^[a-z0-9][a-z0-9-]*$/)
          .parse(url.searchParams.get("slug"));
        const entry = (await registry()).prototypes.find(p => p.slug === slug);
        if (!entry) throw new ProtoError("comment_not_found");
        const state = url.searchParams.get("state") ?? "default";
        if (!entry.states.some(s => s.id === state)) throw new ProtoError("invalid_input");
        const expiresAt = now() + 60000;
        const ticket = signGrant(
          {
            kind: "ticket",
            subject: principal.id,
            audience: options.renderOrigin,
            expires: expiresAt,
          },
          options.ticketSecret
        );
        const href = new URL(`/__proto/render/${slug}`, options.renderOrigin);
        href.searchParams.set("state", state);
        href.searchParams.set("ticket", ticket);
        return Response.json(
          { ticket, url: href.href, expiresAt: new Date(expiresAt).toISOString() },
          { headers: { "Cache-Control": "no-store" } }
        );
      }
      if (path === "credentials" || path.startsWith("credentials/")) {
        if (principal.kind !== "reviewer") throw new ProtoError("scope_denied");
        const publicCredential = ({ hash: _hash, ...value }: import("./storage.ts").Credential) =>
          value;
        if (path === "credentials" && request.method === "GET")
          return Response.json({
            credentials: (await options.storage.credentials.list(principal.id)).map(
              publicCredential
            ),
          });
        if (path === "credentials" && request.method === "POST") {
          const text = await request.text();
          if (text.length > 4096) throw new ProtoError("invalid_input");
          const { name } = z
            .object({ name: z.string().trim().min(1).max(100) })
            .parse(JSON.parse(text));
          const token = `pcr_${randomBytes(32).toString("hex")}`;
          const credential = {
            id: crypto.randomUUID(),
            ownerId: principal.id,
            name,
            scopes: ["comment"] as ["comment"],
            hash: credentialHash(token),
            createdAt: new Date(now()).toISOString(),
            lastUsedAt: null,
            revokedAt: null,
          };
          await options.storage.credentials.create(credential);
          return Response.json(
            { credential: publicCredential(credential), token },
            { status: 201, headers: { "Cache-Control": "no-store" } }
          );
        }
        if (/^credentials\/[^/]+$/.test(path) && request.method === "DELETE") {
          await options.storage.credentials.revoke(
            principal.id,
            decodeURIComponent(path.slice(12))
          );
          return new Response(null, { status: 204 });
        }
        throw new ProtoError("invalid_input");
      }
      return router(request);
    }
    const relative = url.pathname.slice(base.length);
    if (relative.startsWith("__proto/render/") || relative.startsWith("review/"))
      return new Response(null, { status: 404 });
    return asset(request, relative || "index.html");
  }
  return async request => {
    const started = now();
    let principal: Principal | null = null;
    let response: Response;
    try {
      response = await dispatch(request, value => {
        principal = value;
      });
    } catch (error) {
      const failure =
        error instanceof ProtoError
          ? error
          : error instanceof z.ZodError || error instanceof SyntaxError
            ? new ProtoError("invalid_input")
            : new ProtoError("internal_error");
      response = Response.json(errorBody(failure), { status: failure.status ?? 500 });
    }
    response = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
    response.headers.set("Cache-Control", "private, no-store");
    // Never log query strings (tickets), bodies, cookies, authorization headers or user ids.
    const entry = {
      route: new URL(request.url).pathname,
      status: response.status,
      principal_kind: (principal as Principal | null)?.kind ?? null,
      duration_ms: Math.max(0, now() - started),
    };
    (options.log ?? (value => console.info(JSON.stringify(value))))(entry);
    return response;
  };
}
