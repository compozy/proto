import { createServer } from "node:http";
import { once } from "node:events";

/** Network-boundary fake shared with session integration suites. No production modules are mocked. */
export async function fakeCloudflare() {
  const state = {
    tokenStatus: "active",
    accounts: [{ id: "account", name: "Acme" }],
    zones: [{ id: "zone", name: "example.com", account: { id: "account", name: "Acme" } }],
    organization: { auth_domain: "acme.cloudflareaccess.com" } as { auth_domain: string } | null,
    providers: [] as Record<string, unknown>[], tunnels: [] as Record<string, unknown>[],
    records: [] as Record<string, unknown>[], apps: [] as Record<string, unknown>[],
    policies: [] as Record<string, unknown>[], ingress: null as unknown,
    calls: [] as { method: string; path: string; body: Record<string, unknown> }[],
    failures: [] as { path: string; status: number; message?: string; retryAfter?: string }[],
  };
  let id = 0;
  const server = createServer(async (request, response) => {
    const url = new URL(request.url!, "http://localhost");
    const path = url.pathname, method = request.method!;
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown> : {};
    state.calls.push({ method, path, body });
    const send = (result: unknown, status = 200, message = "missing") => {
      response.writeHead(status, { "Content-Type": "application/json" });
      const page = Number(url.searchParams.get("page") ?? 1);
      const perPage = Number(url.searchParams.get("per_page") ?? 50);
      const result_info = Array.isArray(result) ? { total_pages: Math.max(1, Math.ceil(result.length / perPage)) } : undefined;
      response.end(JSON.stringify({ success: status < 400,
        result: Array.isArray(result) ? result.slice((page - 1) * perPage, page * perPage) : result,
        result_info, errors: status < 400 ? [] : [{ message }] }));
    };
    const failure = state.failures[0];
    if (failure && path.includes(failure.path)) {
      state.failures.shift();
      if (failure.status === 0) { response.destroy(); return; }
      if (failure.retryAfter) response.setHeader("Retry-After", failure.retryAfter);
      send(null, failure.status, failure.message); return;
    }
    if (path === "/user/tokens/verify") { send({ status: state.tokenStatus }); return; }
    if (path === "/accounts") { send(state.accounts); return; }
    if (path === "/zones") { send(state.zones); return; }
    if (path.endsWith("/organizations")) { send(state.organization, state.organization ? 200 : 404); return; }
    if (path.endsWith("/token")) { send("connector-secret"); return; }
    if (path.endsWith("/configurations")) { state.ingress = body; send(body); return; }
    const collection = path.includes("/identity_providers") ? state.providers
      : path.includes("/dns_records") ? state.records
      : path.includes("/policies") ? state.policies
      : path.includes("/apps") ? state.apps
      : path.includes("/cfd_tunnel") ? state.tunnels : null;
    if (!collection) { send(null, 404); return; }
    const match = path.match(/\/(?:identity_providers|dns_records|policies|apps|cfd_tunnel)(?:\/([^/]+))?$/);
    const resourceId = match?.[1];
    if (method === "GET") {
      if (resourceId) { const item = collection.find(item => item.id === resourceId); send(item ?? null, item ? 200 : 404); }
      else send(collection.filter(item => !url.searchParams.has("name") || item.name === url.searchParams.get("name")));
      return;
    }
    if (method === "DELETE") {
      const index = collection.findIndex(item => item.id === resourceId);
      if (index < 0) send(null, 404);
      else { collection.splice(index, 1); send({ id: resourceId }); }
      return;
    }
    if (method === "PUT") {
      const item = collection.find(item => item.id === resourceId);
      if (!item) send(null, 404); else { Object.assign(item, body); send(item); }
      return;
    }
    const item = { id: String(++id), ...(collection === state.apps ? { aud: "audience" } : {}), ...body };
    collection.push(item); send(item);
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing address");
  return { state, url: `http://127.0.0.1:${address.port}`, async close() { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); } };
}
