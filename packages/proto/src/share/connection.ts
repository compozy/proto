import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { ProtoError } from "../model/errors.ts";
import { CloudflareClient, type Account, type Zone, type AccessApp } from "./cloudflare.ts";

export type Connection = {
  apiToken: string; accountId: string; zoneId: string; teamDomain: string;
  tunnelId: string; tunnelToken: string; shellHost: string; renderHost: string;
  dnsRecordIds: [string, string]; accessAppId: string; accessAud: string; otpProviderId: string;
};
export const connectionPath = () => join(homedir(), ".config/compozy-proto/cloudflare.json");
export async function readConnection(path = connectionPath()): Promise<Connection | null> {
  try {
    const value = JSON.parse(await readFile(path, "utf8")) as Connection;
    const fields = ["apiToken", "accountId", "zoneId", "teamDomain", "tunnelId", "tunnelToken", "shellHost", "renderHost", "accessAppId", "accessAud", "otpProviderId"] as const;
    if (!value || fields.some(field => typeof value[field] !== "string" || !value[field]) ||
      !Array.isArray(value.dnsRecordIds) || value.dnsRecordIds.length !== 2 ||
      value.dnsRecordIds.some(id => typeof id !== "string" || !id)) throw new Error("Invalid connection");
    return value;
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new ProtoError("share_not_connected");
  }
}
async function saveConnection(value: Connection, path: string) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await chmod(dirname(path), 0o700);
  const temporary = `${path}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(value, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    await rename(temporary, path);
    await chmod(path, 0o600);
  } finally { await rm(temporary, { force: true }); }
}
export function defaultLabel(cwd?: string) {
  let user = "user";
  try { user = execFileSync("git", ["config", "user.name"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { /* No Git identity configured. */ }
  return `proto-${user.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "user"}`;
}
export function hostnames(label: string, domain: string) {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,54}[a-z0-9])?$/.test(label))
    throw new ProtoError("invalid_input", "--name must be a DNS label of at most 56 characters.");
  return { shellHost: `${label}.${domain}`, renderHost: `${label}-render.${domain}` };
}
function appBody(label: string, shellHost: string, otp: string) {
  return { type: "self_hosted", name: `proto-share ${label}`, domain: shellHost,
    session_duration: "24h", allowed_idps: [otp], auto_redirect_to_identity: true,
    same_site_cookie_attribute: "lax", http_only_cookie_attribute: true };
}
export type ConnectOptions = {
  apiToken: string; domain?: string; name?: string; cwd?: string; path?: string; client?: CloudflareClient;
  choose?: (kind: "account" | "domain", choices: readonly { id: string; name: string }[]) => Promise<string>;
};
async function choose<T extends Account | Zone>(kind: "account" | "domain", values: T[], options: ConnectOptions): Promise<T> {
  if (!values.length) throw new ProtoError("cloudflare_no_domain");
  if (values.length === 1) return values[0]!;
  const selected = await options.choose?.(kind, values);
  const value = values.find(item => item.id === selected);
  if (!value) throw new ProtoError("invalid_input", `Choose a ${kind}${kind === "domain" ? " with --domain" : " interactively"}.`);
  return value;
}
export async function connect(options: ConnectOptions) {
  const client = options.client ?? new CloudflareClient(options.apiToken);
  await client.verify();
  const accounts = await client.accounts();
  let account: Account;
  let zone: Zone;
  if (options.domain) {
    const matches: { account: Account; zone: Zone }[] = [];
    for (const item of accounts) for (const candidate of await client.zones(item.id))
      if (candidate.name.toLowerCase() === options.domain.toLowerCase()) matches.push({ account: item, zone: candidate });
    if (!matches.length) throw new ProtoError("cloudflare_no_domain");
    account = (await choose("account", matches.map(item => item.account), options));
    zone = matches.find(item => item.account.id === account.id)!.zone;
  } else {
    account = await choose("account", accounts, options);
    zone = await choose("domain", await client.zones(account.id), options);
  }
  const organization = await client.organization(account.id);
  if (!organization?.auth_domain) throw new ProtoError("cloudflare_access_not_enabled");
  const label = options.name ?? defaultLabel(options.cwd);
  const hosts = hostnames(label, zone.name);
  const providers = await client.providers(account.id);
  const otp = providers.find(provider => provider.type === "onetimepin") ?? await client.createProvider(account.id);
  let created = false;
  let tunnel = (await client.tunnels(account.id, label)).find(item => item.name === label);
  if (!tunnel) { tunnel = await client.createTunnel(account.id, label); created = true; }
  const ids: string[] = [];
  for (const host of [hosts.shellHost, hosts.renderHost]) {
    const records = await client.records(zone.id, host);
    if (records.some(record => record.type !== "CNAME" || record.content !== `${tunnel.id}.cfargotunnel.com` || !record.proxied))
      throw new ProtoError("share_hostname_taken", `${host} is already in use. Choose another with --name.`);
    let record = records[0];
    if (!record) { record = await client.createRecord(zone.id, host, tunnel.id); created = true; }
    ids.push(record.id);
  }
  let app = (await client.apps(account.id)).find(item => item.domain === hosts.shellHost && item.name === `proto-share ${label}`);
  const body = appBody(label, hosts.shellHost, otp.id);
  if (app) app = await client.request<AccessApp>("PUT", `/accounts/${account.id}/access/apps/${app.id}`, body);
  else { app = await client.request<AccessApp>("POST", `/accounts/${account.id}/access/apps`, body); created = true; }
  const connection: Connection = {
    apiToken: options.apiToken, accountId: account.id, zoneId: zone.id, teamDomain: organization.auth_domain,
    tunnelId: tunnel.id, tunnelToken: tunnel.token ?? await client.tunnelToken(account.id, tunnel.id),
    ...hosts, dnsRecordIds: [ids[0]!, ids[1]!], accessAppId: app.id, accessAud: app.aud, otpProviderId: otp.id,
  };
  await saveConnection(connection, options.path ?? connectionPath());
  return { link: `https://${hosts.shellHost}`, domain: zone.name, created };
}
export async function disconnect(options: { path?: string; client?: CloudflareClient; running?: () => Promise<{ link: string } | null> } = {}) {
  const running = await options.running?.();
  if (running) throw new ProtoError("share_session_running", `Already sharing at ${running.link}. Run proto share stop.`);
  const path = options.path ?? connectionPath();
  const connection = await readConnection(path);
  const removed: string[] = [];
  if (!connection) return { removed, kept: [] as string[] };
  const c = connection, client = options.client ?? new CloudflareClient(c.apiToken);
  for (const [name, resource] of [
    ["tunnel", `/accounts/${c.accountId}/cfd_tunnel/${c.tunnelId}`],
    ...c.dnsRecordIds.map(id => ["dns", `/zones/${c.zoneId}/dns_records/${id}`]),
    ["access_app", `/accounts/${c.accountId}/access/apps/${c.accessAppId}`],
  ] as [string, string][]) {
    const result = await client.request<unknown>("DELETE", resource, undefined, true);
    if (result !== undefined) removed.push(name);
  }
  await rm(path, { force: true }); removed.push("local");
  return { removed, kept: ["otp_provider"] };
}
const appPath = (c: Connection) => `/accounts/${c.accountId}/access/apps/${c.accessAppId}`;
const stale = (what: string): never => { throw new ProtoError("share_connection_stale", `The Cloudflare setup changed: ${what}. Run proto share connect, or remove that policy.`); };
export async function checkConnection(c: Connection, client = new CloudflareClient(c.apiToken)) {
  await client.verify();
  if (!await client.tunnel(c.accountId, c.tunnelId)) stale("tunnel missing");
  for (const host of [c.shellHost, c.renderHost]) {
    const records = await client.records(c.zoneId, host);
    if (records.length !== 1 || records[0]!.content !== `${c.tunnelId}.cfargotunnel.com` || records[0]!.type !== "CNAME" || !records[0]!.proxied) stale(`hostname ${host}`);
  }
  const app = await client.app(c.accountId, c.accessAppId);
  if (!app) stale("application missing");
  const expected = appBody(c.shellHost.split(".")[0]!, c.shellHost, c.otpProviderId);
  for (const field of Object.keys(expected) as (keyof typeof expected)[])
    if (JSON.stringify(app[field]) !== JSON.stringify(expected[field])) stale(`application ${field}`);
  const policies = await client.policies(c.accountId, c.accessAppId);
  for (const policy of policies) if (policy.name !== "proto-share invitees") stale(`policy ${policy.name}`);
}
export async function closeInvitations(c: Connection, client = new CloudflareClient(c.apiToken)) {
  for (const policy of await client.policies(c.accountId, c.accessAppId)) {
    if (policy.name !== "proto-share invitees") stale(`policy ${policy.name}`);
    await client.request("DELETE", `${appPath(c)}/policies/${policy.id}`, undefined, true);
  }
}
export async function openInvitations(c: Connection, emails: readonly string[], client = new CloudflareClient(c.apiToken)) {
  if (!emails.length) throw new ProtoError("share_no_invitees");
  await closeInvitations(c, client);
  return client.request<{ id: string }>("POST", `${appPath(c)}/policies`, {
    name: "proto-share invitees", decision: "allow", include: [...new Set(emails.map(email => email.toLowerCase()))].map(email => ({ email: { email } })),
  });
}
export async function setIngress(c: Connection, port: number, client = new CloudflareClient(c.apiToken)) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new ProtoError("invalid_input");
  return client.request("PUT", `/accounts/${c.accountId}/cfd_tunnel/${c.tunnelId}/configurations`, {
    config: { ingress: [...[c.shellHost, c.renderHost].map(hostname => ({ hostname, service: `http://127.0.0.1:${port}` })), { service: "http_status:404" }] },
  });
}
