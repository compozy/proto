import { afterEach, expect, it } from "vitest";
import { mkdtemp, rm, stat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CloudflareClient } from "../../../src/share/cloudflare.ts";
import {
  connect,
  disconnect,
  readConnection,
  checkConnection,
  openInvitations,
  closeInvitations,
  setIngress,
  type Connection,
} from "../../../src/share/connection.ts";
import { fakeCloudflare } from "./cloudflare-fixture.ts";

// Invariant owner: Cloudflare provisioning at the network boundary. Canonical suite: node/share.
const disposals: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const dispose of disposals.splice(0).reverse()) await dispose();
});
async function fixture() {
  const api = await fakeCloudflare();
  disposals.push(() => api.close());
  const directory = await mkdtemp(join(tmpdir(), "proto-connect-"));
  disposals.push(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "config/cloudflare.json");
  const client = new CloudflareClient("api-secret", api.url);
  const options = { apiToken: "api-secret", name: "team-review", client, path };
  return {
    ...api,
    path,
    client,
    options,
    async saved() {
      return (await readConnection(path))!;
    },
  };
}
it("IT-001/002: connect provisions exact resources and private credentials; repeating creates none", async () => {
  const f = await fixture();
  expect(await connect(f.options)).toEqual({
    link: "https://team-review.example.com",
    domain: "example.com",
    created: true,
  });
  const c = await f.saved();
  expect((await stat(f.path)).mode & 0o777).toBe(0o600);
  expect((await stat(join(f.path, ".."))).mode & 0o777).toBe(0o700);
  expect(f.state.records).toHaveLength(2);
  expect(c.dnsRecordIds).toEqual(
    [c.shellHost, c.renderHost].map(
      host => f.state.records.find(record => record.name === host)?.id
    )
  );
  expect(
    f.state.records.every(
      record => record.proxied === true && record.content === `${c.tunnelId}.cfargotunnel.com`
    )
  ).toBe(true);
  expect(f.state.apps[0]).toMatchObject({
    allowed_idps: [c.otpProviderId],
    session_duration: "24h",
    same_site_cookie_attribute: "lax",
    http_only_cookie_attribute: true,
    auto_redirect_to_identity: true,
  });
  expect(await connect(f.options)).toMatchObject({ created: false });
  expect(f.state.tunnels).toHaveLength(1);
  expect(f.state.apps).toHaveLength(1);
  await checkConnection(c, f.client);
});
it("IT-003: invalid token, absent organization and absent domain fail before provisioning", async () => {
  const f = await fixture();
  f.state.failures.push({ path: "/verify", status: 401, message: "Access: Edit" });
  await expect(connect(f.options)).rejects.toMatchObject({
    code: "cloudflare_token_invalid",
    message: expect.stringContaining("Access: Edit"),
  });
  f.state.organization = null;
  await expect(connect(f.options)).rejects.toMatchObject({ code: "cloudflare_access_not_enabled" });
  f.state.zones = [];
  await expect(connect(f.options)).rejects.toMatchObject({ code: "cloudflare_no_domain" });
  expect(f.state.tunnels).toHaveLength(0);
});
// Invariant: stale resources suggest reconnecting; only foreign policies suggest policy removal.
// Owner/canonical suite: provisioning at the HTTP boundary, node/share/connection.
it.each([
  ["tunnel", "tunnel missing", "Run proto share connect."],
  ["hostname", "hostname team-review.example.com", "Run proto share connect."],
  ["application", "application missing", "Run proto share connect."],
  ["allowed_idps", "application allowed_idps", "Run proto share connect."],
  ["session_duration", "application session_duration", "Run proto share connect."],
  [
    "same_site_cookie_attribute",
    "application same_site_cookie_attribute",
    "Run proto share connect.",
  ],
  [
    "http_only_cookie_attribute",
    "application http_only_cookie_attribute",
    "Run proto share connect.",
  ],
  ["policy", "policy Other policy", "Run proto share connect, or remove that policy."],
])(
  "IT-003: startup reports the cause and corrective action for %s",
  async (resource, cause, action) => {
    const f = await fixture();
    await connect(f.options);
    const c = await f.saved();
    if (resource === "tunnel") f.state.tunnels = [];
    else if (resource === "hostname") f.state.records = [];
    else if (resource === "application") f.state.apps = [];
    else if (resource === "policy") f.state.policies.push({ id: "foreign", name: "Other policy" });
    else {
      const app = f.state.apps[0];
      if (!app) throw new Error("Expected a provisioned Access application");
      app[resource] = "changed";
    }
    await expect(checkConnection(c, f.client)).rejects.toMatchObject({
      code: "share_connection_stale",
      message: `The Cloudflare setup changed: ${cause}. ${action}`,
    });
  }
);
it.each(["team-review.example.com", "team-review-render.example.com"])(
  "IT-004: foreign hostname %s prevents DNS creation",
  async name => {
    const f = await fixture();
    const record = {
      id: "foreign",
      name,
      type: "CNAME",
      content: "foreign.example.com",
      proxied: true,
    };
    f.state.records.push(record);
    await expect(connect(f.options)).rejects.toMatchObject({ code: "share_hostname_taken" });
    expect(f.state.records).toEqual([record]);
  }
);
it("IT-005: failure after tunnel creation resumes; another machine adopts and restores the app", async () => {
  const f = await fixture();
  f.state.failures.push({ path: "/dns_records", status: 500 });
  await expect(connect(f.options)).rejects.toMatchObject({ code: "cloudflare_api_error" });
  expect(f.state.tunnels).toHaveLength(1);
  await connect(f.options);
  await rm(f.path);
  f.state.apps[0]!.session_duration = "1h";
  expect(await connect(f.options)).toMatchObject({ created: false });
  expect(f.state.apps[0]!.session_duration).toBe("24h");
  expect(f.state.calls.some(call => call.path.endsWith("/token"))).toBe(true);
  expect(f.state.calls.some(call => call.method === "PUT" && call.path.includes("/apps/"))).toBe(
    true
  );
});
// Invariant: tunnel removal precedes independent DNS removals, then Access and local credentials.
// Owner/canonical suite: node/share/connection at the Cloudflare HTTP boundary.
it.each([false, true])(
  "IT-006: disconnect preserves deletion order and OTP with missing DNS = %s",
  async missing => {
    const f = await fixture();
    await connect(f.options);
    const c = await f.saved();
    if (missing) f.state.records.shift();
    f.state.calls.length = 0;
    const result = await disconnect({ path: f.path, client: f.client });
    expect(result.kept).toEqual(["otp_provider"]);
    expect(result.removed).toEqual(
      missing
        ? ["tunnel", "dns", "access_app", "local"]
        : ["tunnel", "dns", "dns", "access_app", "local"]
    );
    const deletions = f.state.calls.filter(call => call.method === "DELETE");
    expect(deletions[0]?.path).toBe(`/accounts/${c.accountId}/cfd_tunnel/${c.tunnelId}`);
    expect(
      deletions
        .slice(1, 3)
        .map(call => call.path)
        .sort()
    ).toEqual(c.dnsRecordIds.map(id => `/zones/${c.zoneId}/dns_records/${id}`).sort());
    expect(deletions[3]?.path).toBe(`/accounts/${c.accountId}/access/apps/${c.accessAppId}`);
    expect(f.state.providers).toHaveLength(1);
    expect(f.state.records).toHaveLength(0);
    expect(f.state.tunnels).toHaveLength(0);
    expect(f.state.apps).toHaveLength(0);
    expect(await readConnection(f.path)).toBeNull();
    expect(await disconnect({ path: f.path, client: f.client })).toEqual({ removed: [], kept: [] });
  }
);
it.each(["tunnel", "dns", "access_app"] as const)(
  "IT-006: failed %s deletion retains local credentials for retry",
  async resource => {
    const f = await fixture();
    await connect(f.options);
    const c = await f.saved();
    const before = await readFile(f.path, "utf8");
    const paths = {
      tunnel: `/cfd_tunnel/${c.tunnelId}`,
      dns: `/dns_records/${c.dnsRecordIds[0]}`,
      access_app: `/access/apps/${c.accessAppId}`,
    };
    f.state.failures.push({ path: paths[resource], status: 500 });
    await expect(disconnect({ path: f.path, client: f.client })).rejects.toMatchObject({
      code: "cloudflare_api_error",
    });
    expect(await readFile(f.path, "utf8")).toBe(before);
    if (resource !== "access_app") expect(f.state.apps).toHaveLength(1);
    await disconnect({ path: f.path, client: f.client });
    expect(await readConnection(f.path)).toBeNull();
    expect(f.state.records).toHaveLength(0);
    expect(f.state.providers).toHaveLength(1);
  }
);
it("connection ownership: disconnect refuses a running session without touching credentials", async () => {
  const f = await fixture();
  await connect(f.options);
  const before = await readFile(f.path, "utf8");
  await expect(
    disconnect({
      path: f.path,
      client: f.client,
      running: async () => ({ link: "https://example.com" }),
    })
  ).rejects.toMatchObject({ code: "share_session_running" });
  expect(await readFile(f.path, "utf8")).toBe(before);
});
it("session helpers replace named invitation policies and set loopback ingress with a catch-all", async () => {
  const f = await fixture();
  await connect(f.options);
  const c: Connection = await f.saved();
  await openInvitations(c, ["Ana@example.com"], f.client);
  await openInvitations(c, ["bob@example.com"], f.client);
  expect(f.state.policies).toHaveLength(1);
  expect(f.state.policies[0]).toMatchObject({ include: [{ email: { email: "bob@example.com" } }] });
  await setIngress(c, 12345, f.client);
  expect(f.state.ingress).toEqual({
    config: {
      ingress: [
        { hostname: c.shellHost, service: "http://127.0.0.1:12345" },
        { hostname: c.renderHost, service: "http://127.0.0.1:12345" },
        { service: "http_status:404" },
      ],
    },
  });
  await closeInvitations(c, f.client);
  expect(f.state.policies).toHaveLength(0);
});
it("UT-014: 429 honors Retry-After, retries once and surfaces the second failure", async () => {
  const f = await fixture();
  f.state.failures.push({ path: "/verify", status: 429, retryAfter: "1" });
  const start = Date.now();
  await f.client.verify();
  expect(Date.now() - start).toBeGreaterThanOrEqual(950);
  f.state.failures.push(
    { path: "/verify", status: 429, retryAfter: "0" },
    { path: "/verify", status: 429 }
  );
  await expect(f.client.verify()).rejects.toMatchObject({ code: "cloudflare_api_error" });
});

// Invariants: stop revokes owned policies even with a foreign policy; API retries cannot
// duplicate creates, and list traversal ends at the provider's final page.
// Owner/canonical suite: node/share/connection at the Cloudflare network boundary.
it("OPUS-N02: foreign policies are reported after own invitations have been deleted", async () => {
  const f = await fixture();
  await connect(f.options);
  const c = await f.saved();
  f.state.policies.push({ id: "foreign", name: "Dashboard policy" });
  f.state.policies.push({ id: "own", name: "proto-share invitees" });
  f.state.policies.push({ id: "own-other", name: "proto-share invitees" });
  await expect(closeInvitations(c, f.client)).rejects.toMatchObject({
    code: "share_connection_stale",
    message:
      "The Cloudflare setup changed: policy Dashboard policy. Run proto share connect, or remove that policy.",
  });
  expect(f.state.policies).toEqual([{ id: "foreign", name: "Dashboard policy" }]);
});
it("OPUS-N03: blank and inactive tokens fail before provisioning", async () => {
  expect(() => new CloudflareClient(" ")).toThrowError(
    expect.objectContaining({ code: "cloudflare_token_invalid" })
  );
  const f = await fixture();
  f.state.tokenStatus = "disabled";
  await expect(connect(f.options)).rejects.toMatchObject({ code: "cloudflare_token_invalid" });
  expect(f.state.tunnels).toEqual([]);
});
it("OPUS-N07: a network failure retries reads once but never repeats a create", async () => {
  const f = await fixture();
  f.state.failures.push({ path: "/verify", status: 0 });
  await f.client.verify();
  expect(f.state.calls.filter(call => call.path.endsWith("/verify"))).toHaveLength(2);
  f.state.failures.push({ path: "/cfd_tunnel", status: 0 });
  await expect(f.client.createTunnel("account", "test")).rejects.toMatchObject({
    code: "cloudflare_api_error",
  });
  expect(
    f.state.calls.filter(call => call.method === "POST" && call.path.endsWith("/cfd_tunnel"))
  ).toHaveLength(1);
});
it("OPUS-N07: list uses total_pages, including a full final page", async () => {
  const f = await fixture();
  f.state.accounts = Array.from({ length: 100 }, (_, id) => ({
    id: String(id),
    name: `Account ${id}`,
  }));
  expect(await f.client.accounts()).toEqual(f.state.accounts);
  expect(f.state.calls.filter(call => call.path === "/accounts")).toHaveLength(2);
});

// Invariant: absent total_pages cannot hide resources on later pages.
// Owner/canonical suite: node/share/connection at the Cloudflare network boundary.
it.each([
  ["total_count", 100, 2],
  ["total_count", 101, 3],
  ["none", 100, 3],
  ["none", 101, 3],
] as const)(
  "OPUS-N09: list with %s metadata returns all %i apps in %i pages",
  async (pagination, count, pages) => {
    const f = await fixture();
    f.state.pagination = pagination;
    f.state.apps = Array.from({ length: count }, (_, id) => ({
      id: String(id),
      name: `App ${id}`,
    }));
    expect(await f.client.apps("account")).toEqual(f.state.apps);
    expect(f.state.calls.filter(call => call.path.endsWith("/access/apps"))).toHaveLength(pages);
  }
);
