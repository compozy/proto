import { afterEach, expect, it } from "vitest";
import { mkdtemp, rm, stat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CloudflareClient } from "../../../src/share/cloudflare.ts";
import { connect, disconnect, readConnection, checkConnection, openInvitations, closeInvitations, setIngress, type Connection } from "../../../src/share/connection.ts";
import { fakeCloudflare } from "./cloudflare-fixture.ts";

// Invariant owner: Cloudflare provisioning at the network boundary. Canonical suite: node/share.
const disposals: (() => Promise<unknown>)[] = [];
afterEach(async () => { for (const dispose of disposals.splice(0).reverse()) await dispose(); });
async function fixture() {
  const api = await fakeCloudflare(); disposals.push(() => api.close());
  const directory = await mkdtemp(join(tmpdir(), "proto-connect-"));
  disposals.push(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "config/cloudflare.json");
  const client = new CloudflareClient("api-secret", api.url);
  const options = { apiToken: "api-secret", name: "team-review", client, path };
  return { ...api, path, client, options, async saved() { return (await readConnection(path))!; } };
}
it("IT-001/002: connect provisions exact resources and private credentials; repeating creates none", async () => {
  const f = await fixture();
  expect(await connect(f.options)).toEqual({ link: "https://team-review.example.com", domain: "example.com", created: true });
  const c = await f.saved();
  expect((await stat(f.path)).mode & 0o777).toBe(0o600);
  expect((await stat(join(f.path, ".."))).mode & 0o777).toBe(0o700);
  expect(f.state.records).toHaveLength(2);
  expect(f.state.records.every(record => record.proxied === true && record.content === `${c.tunnelId}.cfargotunnel.com`)).toBe(true);
  expect(f.state.apps[0]).toMatchObject({ allowed_idps: [c.otpProviderId], session_duration: "24h", same_site_cookie_attribute: "lax", http_only_cookie_attribute: true, auto_redirect_to_identity: true });
  expect(await connect(f.options)).toMatchObject({ created: false });
  expect(f.state.tunnels).toHaveLength(1); expect(f.state.apps).toHaveLength(1);
  await checkConnection(c, f.client);
});
it("IT-003: invalid token, absent organization and absent domain fail before provisioning", async () => {
  const f = await fixture();
  f.state.failures.push({ path: "/verify", status: 401, message: "Access: Edit" });
  await expect(connect(f.options)).rejects.toMatchObject({ code: "cloudflare_token_invalid", message: expect.stringContaining("Access: Edit") });
  f.state.organization = null;
  await expect(connect(f.options)).rejects.toMatchObject({ code: "cloudflare_access_not_enabled" });
  f.state.zones = [];
  await expect(connect(f.options)).rejects.toMatchObject({ code: "cloudflare_no_domain" });
  expect(f.state.tunnels).toHaveLength(0);
});
it("IT-003: startup rejects missing resources, altered app settings and foreign policies", async () => {
  const f = await fixture(); await connect(f.options); const c = await f.saved();
  const changes: (() => () => void)[] = [
    () => { const saved = f.state.tunnels.splice(0); return () => { f.state.tunnels.push(...saved); }; },
    () => { const saved = f.state.records.splice(0); return () => { f.state.records.push(...saved); }; },
    () => { const saved = f.state.apps.splice(0); return () => { f.state.apps.push(...saved); }; },
    ...["allowed_idps", "session_duration", "same_site_cookie_attribute", "http_only_cookie_attribute"].map(field => () => { const saved = f.state.apps[0]![field]; f.state.apps[0]![field] = "changed"; return () => { f.state.apps[0]![field] = saved; }; }),
    () => { f.state.policies.push({ id: "foreign", name: "Other policy" }); return () => { f.state.policies = []; }; },
  ];
  for (const change of changes) { const restore = change(); await expect(checkConnection(c, f.client)).rejects.toMatchObject({ code: "share_connection_stale" }); restore(); }
});
it("IT-004: a foreign hostname is never overwritten", async () => {
  const f = await fixture();
  const record = { id: "foreign", name: "team-review.example.com", type: "CNAME", content: "foreign.example.com", proxied: true };
  f.state.records.push(record);
  await expect(connect(f.options)).rejects.toMatchObject({ code: "share_hostname_taken" });
  expect(f.state.records).toEqual([record]);
});
it("IT-005: failure after tunnel creation resumes; another machine adopts and restores the app", async () => {
  const f = await fixture();
  f.state.failures.push({ path: "/dns_records", status: 500 });
  await expect(connect(f.options)).rejects.toMatchObject({ code: "cloudflare_api_error" });
  expect(f.state.tunnels).toHaveLength(1);
  await connect(f.options); await rm(f.path);
  f.state.apps[0]!.session_duration = "1h";
  expect(await connect(f.options)).toMatchObject({ created: false });
  expect(f.state.apps[0]!.session_duration).toBe("24h");
  expect(f.state.calls.some(call => call.path.endsWith("/token"))).toBe(true);
  expect(f.state.calls.some(call => call.method === "PUT" && call.path.includes("/apps/"))).toBe(true);
});
it("IT-006: disconnect skips missing resources and preserves the organization email provider", async () => {
  const f = await fixture(); await connect(f.options); f.state.records.shift();
  const result = await disconnect({ path: f.path, client: f.client });
  expect(result.kept).toEqual(["otp_provider"]); expect(result.removed).toContain("local");
  expect(f.state.providers).toHaveLength(1); expect(f.state.tunnels).toHaveLength(0); expect(f.state.apps).toHaveLength(0);
  expect(await readConnection(f.path)).toBeNull();
  expect(await disconnect({ path: f.path, client: f.client })).toEqual({ removed: [], kept: [] });
});
it("connection ownership: disconnect refuses a running session without touching credentials", async () => {
  const f = await fixture(); await connect(f.options);
  const before = await readFile(f.path, "utf8");
  await expect(disconnect({ path: f.path, client: f.client, running: async () => ({ link: "https://example.com" }) })).rejects.toMatchObject({ code: "share_session_running" });
  expect(await readFile(f.path, "utf8")).toBe(before);
});
it("session helpers replace named invitation policies and set loopback ingress with a catch-all", async () => {
  const f = await fixture(); await connect(f.options); const c: Connection = await f.saved();
  await openInvitations(c, ["Ana@example.com"], f.client);
  await openInvitations(c, ["bob@example.com"], f.client);
  expect(f.state.policies).toHaveLength(1);
  expect(f.state.policies[0]).toMatchObject({ include: [{ email: { email: "bob@example.com" } }] });
  await setIngress(c, 12345, f.client);
  expect(f.state.ingress).toEqual({ config: { ingress: [
    { hostname: c.shellHost, service: "http://127.0.0.1:12345" },
    { hostname: c.renderHost, service: "http://127.0.0.1:12345" }, { service: "http_status:404" },
  ] } });
  await closeInvitations(c, f.client); expect(f.state.policies).toHaveLength(0);
});
it("UT-014: 429 honors Retry-After, retries once and surfaces the second failure", async () => {
  const f = await fixture();
  f.state.failures.push({ path: "/verify", status: 429, retryAfter: "1" });
  const start = Date.now(); await f.client.verify(); expect(Date.now() - start).toBeGreaterThanOrEqual(950);
  f.state.failures.push({ path: "/verify", status: 429, retryAfter: "0" }, { path: "/verify", status: 429 });
  await expect(f.client.verify()).rejects.toMatchObject({ code: "cloudflare_api_error" });
});

// Invariants: stop revokes owned policies even with a foreign policy; API retries cannot
// duplicate creates, and list traversal ends at the provider's final page.
// Owner/canonical suite: node/share/connection at the Cloudflare network boundary.
it("OPUS-N02: foreign policies are reported after own invitations have been deleted", async () => {
  const f = await fixture(); await connect(f.options); const c = await f.saved();
  f.state.policies.push({ id: "foreign", name: "Dashboard policy" });
  f.state.policies.push({ id: "own", name: "proto-share invitees" });
  await expect(closeInvitations(c, f.client)).rejects.toMatchObject({ code: "share_connection_stale" });
  expect(f.state.policies).toEqual([{ id: "foreign", name: "Dashboard policy" }]);
});
it("OPUS-N03: blank and inactive tokens fail before provisioning", async () => {
  expect(() => new CloudflareClient(" ")).toThrowError(expect.objectContaining({ code: "cloudflare_token_invalid" }));
  const f = await fixture(); f.state.tokenStatus = "disabled";
  await expect(connect(f.options)).rejects.toMatchObject({ code: "cloudflare_token_invalid" });
  expect(f.state.tunnels).toEqual([]);
});
it("OPUS-N07: a network failure retries reads once but never repeats a create", async () => {
  const f = await fixture();
  f.state.failures.push({ path: "/verify", status: 0 });
  await f.client.verify();
  expect(f.state.calls.filter(call => call.path.endsWith("/verify"))).toHaveLength(2);
  f.state.failures.push({ path: "/cfd_tunnel", status: 0 });
  await expect(f.client.createTunnel("account", "test")).rejects.toMatchObject({ code: "cloudflare_api_error" });
  expect(f.state.calls.filter(call => call.method === "POST" && call.path.endsWith("/cfd_tunnel"))).toHaveLength(1);
});
it("OPUS-N07: list uses total_pages, including a full final page", async () => {
  const f = await fixture();
  f.state.accounts = Array.from({ length: 100 }, (_, id) => ({ id: String(id), name: `Account ${id}` }));
  expect(await f.client.accounts()).toEqual(f.state.accounts);
  expect(f.state.calls.filter(call => call.path === "/accounts")).toHaveLength(2);
});

// Invariant: absent total_pages cannot hide resources on later pages.
// Owner/canonical suite: node/share/connection at the Cloudflare network boundary.
it.each([
  ["total_count", 100, 2], ["total_count", 101, 3],
  ["none", 100, 3], ["none", 101, 3],
] as const)("OPUS-N09: list with %s metadata returns all %i apps in %i pages", async (pagination, count, pages) => {
  const f = await fixture();
  f.state.pagination = pagination;
  f.state.apps = Array.from({ length: count }, (_, id) => ({ id: String(id), name: `App ${id}` }));
  expect(await f.client.apps("account")).toEqual(f.state.apps);
  expect(f.state.calls.filter(call => call.path.endsWith("/access/apps"))).toHaveLength(pages);
});
