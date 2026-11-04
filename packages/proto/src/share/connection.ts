import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { ProtoError } from "../model/errors.ts";
import {
  CloudflareClient,
  type Account,
  type Zone,
  type AccessApp,
  type DnsRecord,
} from "./cloudflare.ts";

export type Connection = {
  apiToken: string;
  accountId: string;
  zoneId: string;
  teamDomain: string;
  tunnelId: string;
  tunnelToken: string;
  shellHost: string;
  renderHost: string;
  dnsRecordIds: [string, string];
  accessAppId: string;
  accessAud: string;
  otpProviderId: string;
};
export const connectionPath = () => join(homedir(), ".config/compozy-proto/cloudflare.json");
export async function readConnection(path = connectionPath()): Promise<Connection | null> {
  try {
    const value = JSON.parse(await readFile(path, "utf8")) as Connection;
    const fields = [
      "apiToken",
      "accountId",
      "zoneId",
      "teamDomain",
      "tunnelId",
      "tunnelToken",
      "shellHost",
      "renderHost",
      "accessAppId",
      "accessAud",
      "otpProviderId",
    ] as const;
    if (
      !value ||
      fields.some(field => typeof value[field] !== "string" || !value[field]) ||
      !Array.isArray(value.dnsRecordIds) ||
      value.dnsRecordIds.length !== 2 ||
      value.dnsRecordIds.some(id => typeof id !== "string" || !id)
    )
      throw new Error("Invalid connection");
    return value;
  } catch (error) {
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
  } finally {
    await rm(temporary, { force: true });
  }
}
export function defaultLabel(cwd?: string) {
  let user = "user";
  try {
    user = execFileSync("git", ["config", "user.name"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    /* No Git identity configured. */
  }
  return `proto-${
    user
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "user"
  }`;
}
export function hostnames(label: string, domain: string) {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,54}[a-z0-9])?$/.test(label))
    throw new ProtoError("invalid_input", "--name must be a DNS label of at most 56 characters.");
  return { shellHost: `${label}.${domain}`, renderHost: `${label}-render.${domain}` };
}
function appBody(label: string, shellHost: string, otp: string) {
  return {
    type: "self_hosted",
    name: `proto-share ${label}`,
    domain: shellHost,
    session_duration: "24h",
    allowed_idps: [otp],
    auto_redirect_to_identity: true,
    same_site_cookie_attribute: "lax",
    http_only_cookie_attribute: true,
  };
}
export type ConnectOptions = {
  apiToken: string;
  domain?: string;
  name?: string;
  cwd?: string;
  path?: string;
  client?: CloudflareClient;
  choose?: (
    kind: "account" | "domain",
    choices: readonly { id: string; name: string }[]
  ) => Promise<string>;
};
async function choose<T extends Account | Zone>(
  kind: "account" | "domain",
  values: T[],
  options: ConnectOptions
): Promise<T> {
  if (!values.length) throw new ProtoError("cloudflare_no_domain");
  if (values.length === 1) return values[0]!;
  const selected = await options.choose?.(kind, values);
  const value = values.find(item => item.id === selected);
  if (!value)
    throw new ProtoError(
      "invalid_input",
      `Choose a ${kind}${kind === "domain" ? " with --domain" : " interactively"}.`
    );
  return value;
}
export async function connect(options: ConnectOptions) {
  const client = options.client ?? new CloudflareClient(options.apiToken);
  await client.verify();
  const accounts = await client.accounts();
  let account: Account;
  let zone: Zone;
  if (options.domain) {
    const domain = options.domain.toLowerCase();
    const matchesByAccount = await Promise.all(
      accounts.map(async item => {
        const zones = await client.zones(item.id);
        return zones
          .filter(candidate => candidate.name.toLowerCase() === domain)
          .map(candidate => ({ account: item, zone: candidate }));
      })
    );
    const matches = matchesByAccount.flat();
    if (!matches.length) throw new ProtoError("cloudflare_no_domain");
    account = await choose(
      "account",
      matches.map(item => item.account),
      options
    );
    const match = matches.find(item => item.account.id === account.id);
    if (!match) throw new ProtoError("cloudflare_no_domain");
    zone = match.zone;
  } else {
    account = await choose("account", accounts, options);
    zone = await choose("domain", await client.zones(account.id), options);
  }
  const organization = await client.organization(account.id);
  if (!organization?.auth_domain) throw new ProtoError("cloudflare_access_not_enabled");
  const label = options.name ?? defaultLabel(options.cwd);
  const hosts = hostnames(label, zone.name);
  const providers = await client.providers(account.id);
  const otp =
    providers.find(provider => provider.type === "onetimepin") ??
    (await client.createProvider(account.id));
  let created = false;
  let tunnel = (await client.tunnels(account.id, label)).find(item => item.name === label);
  if (!tunnel) {
    tunnel = await client.createTunnel(account.id, label);
    created = true;
  }
  const names = [hosts.shellHost, hosts.renderHost] as const;
  const existing = await Promise.all(
    names.map(async host => ({ host, records: await client.records(zone.id, host) }))
  );
  for (const { host, records } of existing) {
    if (
      records.some(
        record =>
          record.type !== "CNAME" ||
          record.content !== `${tunnel.id}.cfargotunnel.com` ||
          !record.proxied
      )
    )
      throw new ProtoError(
        "share_hostname_taken",
        `${host} is already in use. Choose another with --name.`
      );
  }
  // Both hostnames are validated above; independent creates retain shell/render result order.
  const tunnelId = tunnel.id;
  const records = await Promise.all(
    existing.map(async ({ host, records }) => {
      if (records[0]) return records[0];
      created = true;
      return client.createRecord(zone.id, host, tunnelId);
    }) as [Promise<DnsRecord>, Promise<DnsRecord>]
  );
  let app = (await client.apps(account.id)).find(
    item => item.domain === hosts.shellHost && item.name === `proto-share ${label}`
  );
  const body = appBody(label, hosts.shellHost, otp.id);
  if (app)
    app = await client.request<AccessApp>(
      "PUT",
      `/accounts/${account.id}/access/apps/${app.id}`,
      body
    );
  else {
    app = await client.request<AccessApp>("POST", `/accounts/${account.id}/access/apps`, body);
    created = true;
  }
  const connection: Connection = {
    apiToken: options.apiToken,
    accountId: account.id,
    zoneId: zone.id,
    teamDomain: organization.auth_domain,
    tunnelId: tunnel.id,
    tunnelToken: tunnel.token ?? (await client.tunnelToken(account.id, tunnel.id)),
    ...hosts,
    dnsRecordIds: [records[0].id, records[1].id],
    accessAppId: app.id,
    accessAud: app.aud,
    otpProviderId: otp.id,
  };
  await saveConnection(connection, options.path ?? connectionPath());
  return { link: `https://${hosts.shellHost}`, domain: zone.name, created };
}
export async function disconnect(
  options: {
    path?: string;
    client?: CloudflareClient;
    running?: () => Promise<{ link: string } | null>;
  } = {}
) {
  const running = await options.running?.();
  if (running)
    throw new ProtoError(
      "share_session_running",
      `Already sharing at ${running.link}. Run proto share stop.`
    );
  const path = options.path ?? connectionPath();
  const connection = await readConnection(path);
  const removed: string[] = [];
  if (!connection) return { removed, kept: [] as string[] };
  const c = connection,
    client = options.client ?? new CloudflareClient(c.apiToken);
  // Close the tunnel first; retain local credentials until every remote deletion succeeds.
  const tunnel = await client.request<unknown>(
    "DELETE",
    `/accounts/${c.accountId}/cfd_tunnel/${c.tunnelId}`,
    undefined,
    true
  );
  if (tunnel !== undefined) removed.push("tunnel");
  const records = await Promise.all(
    c.dnsRecordIds.map(id =>
      client.request<unknown>("DELETE", `/zones/${c.zoneId}/dns_records/${id}`, undefined, true)
    )
  );
  removed.push(...records.filter(record => record !== undefined).map(() => "dns"));
  const app = await client.request<unknown>(
    "DELETE",
    `/accounts/${c.accountId}/access/apps/${c.accessAppId}`,
    undefined,
    true
  );
  if (app !== undefined) removed.push("access_app");
  await rm(path, { force: true });
  removed.push("local");
  return { removed, kept: ["otp_provider"] };
}
const appPath = (c: Connection) => `/accounts/${c.accountId}/access/apps/${c.accessAppId}`;
function stale(what: string, action = "Run proto share connect."): never {
  throw new ProtoError(
    "share_connection_stale",
    `The Cloudflare setup changed: ${what}. ${action}`
  );
}
export async function checkConnection(c: Connection, client = new CloudflareClient(c.apiToken)) {
  await client.verify();
  if (!(await client.tunnel(c.accountId, c.tunnelId))) stale("tunnel missing");
  const hosts = [c.shellHost, c.renderHost];
  const recordsByHost = await Promise.all(
    hosts.map(async host => ({ host, records: await client.records(c.zoneId, host) }))
  );
  for (const { host, records } of recordsByHost) {
    const record = records[0];
    if (
      records.length !== 1 ||
      !record ||
      record.content !== `${c.tunnelId}.cfargotunnel.com` ||
      record.type !== "CNAME" ||
      !record.proxied
    )
      stale(`hostname ${host}`);
  }
  const app = await client.app(c.accountId, c.accessAppId);
  if (!app) stale("application missing");
  const expected = appBody(c.shellHost.split(".")[0]!, c.shellHost, c.otpProviderId);
  for (const field of Object.keys(expected) as (keyof typeof expected)[])
    if (JSON.stringify(app[field]) !== JSON.stringify(expected[field]))
      stale(`application ${field}`);
  const policies = await client.policies(c.accountId, c.accessAppId);
  for (const policy of policies)
    if (policy.name !== "proto-share invitees")
      stale(`policy ${policy.name}`, "Run proto share connect, or remove that policy.");
}
export async function closeInvitations(c: Connection, client = new CloudflareClient(c.apiToken)) {
  const policies = await client.policies(c.accountId, c.accessAppId);
  await Promise.all(
    policies
      .filter(policy => policy.name === "proto-share invitees")
      .map(policy =>
        client.request("DELETE", `${appPath(c)}/policies/${policy.id}`, undefined, true)
      )
  );
  const foreign = policies.find(policy => policy.name !== "proto-share invitees");
  if (foreign) stale(`policy ${foreign.name}`, "Run proto share connect, or remove that policy.");
}
export async function openInvitations(
  c: Connection,
  emails: readonly string[],
  client = new CloudflareClient(c.apiToken)
) {
  if (!emails.length) throw new ProtoError("share_no_invitees");
  await closeInvitations(c, client);
  return client.request<{ id: string }>("POST", `${appPath(c)}/policies`, {
    name: "proto-share invitees",
    decision: "allow",
    include: [...new Set(emails.map(email => email.toLowerCase()))].map(email => ({
      email: { email },
    })),
  });
}
export async function setIngress(
  c: Connection,
  port: number,
  client = new CloudflareClient(c.apiToken)
) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new ProtoError("invalid_input");
  return client.request("PUT", `/accounts/${c.accountId}/cfd_tunnel/${c.tunnelId}/configurations`, {
    config: {
      ingress: [
        ...[c.shellHost, c.renderHost].map(hostname => ({
          hostname,
          service: `http://127.0.0.1:${port}`,
        })),
        { service: "http_status:404" },
      ],
    },
  });
}
