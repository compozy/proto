import { ProtoError } from "../model/errors.ts";

export type Account = { id: string; name: string };
export type Zone = { id: string; name: string; account: Account };
export type Tunnel = { id: string; name: string; token?: string; connections?: unknown[] };
export type DnsRecord = { id: string; name: string; type: string; content: string; proxied: boolean };
export type AccessApp = {
  id: string; aud: string; name: string; domain: string; type: string;
  session_duration: string; allowed_idps: string[]; auto_redirect_to_identity: boolean;
  same_site_cookie_attribute: string; http_only_cookie_attribute: boolean;
};
export type Policy = { id: string; name: string; decision: string };
type Envelope<T> = {
  success?: boolean; result?: T; errors?: { message: string }[];
  result_info?: { total_pages?: number };
};
export class CloudflareClient {
  constructor(private readonly token: string, private readonly baseUrl = "https://api.cloudflare.com/client/v4") {
    if (!token.trim()) throw new ProtoError("cloudflare_token_invalid");
  }

  private async list<T>(path: string): Promise<T[]> {
    const result: T[] = [];
    for (let page = 1; ; page++) {
      const separator = path.includes("?") ? "&" : "?";
      const envelope = await this.requestEnvelope<T[]>("GET", `${path}${separator}per_page=50&page=${page}`);
      result.push(...(envelope.result ?? []));
      if (page >= (envelope.result_info?.total_pages ?? 1)) return result;
    }
  }

  async request<T>(method: string, path: string, body?: unknown, missing = false): Promise<T> {
    return (await this.requestEnvelope<T>(method, path, body, missing)).result as T;
  }
  private async requestEnvelope<T>(method: string, path: string, body?: unknown, missing = false): Promise<Envelope<T>> {
    for (let attempt = 0; attempt < 2; attempt++) {
      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}${path}`, {
          method, headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(10000), redirect: "error",
        });
      } catch {
        if (!attempt && method === "GET") continue;
        throw new ProtoError("cloudflare_api_error", "Cloudflare said: network request failed.");
      }
      if (response.status === 429 && !attempt) {
        const delay = response.headers.get("retry-after") ?? "1";
        const ms = /^\d+(\.\d+)?$/.test(delay) ? Number(delay) * 1000 : Date.parse(delay) - Date.now();
        await response.body?.cancel();
        await new Promise(resolve => setTimeout(resolve, Math.max(0, Number.isFinite(ms) ? ms : 1000)));
        continue;
      }
      if (response.status === 404 && missing) { await response.body?.cancel(); return {}; }
      const envelope = await response.json().catch(() => ({})) as Envelope<T>;
      const message = (envelope.errors?.map(error => error.message).join("; ") || response.statusText)
        .split(this.token).join("[redacted]");
      if (response.status === 401 || response.status === 403)
        throw new ProtoError("cloudflare_token_invalid", `The token is invalid or lacks permission: ${message}.`);
      if (!response.ok || envelope.success === false)
        throw new ProtoError("cloudflare_api_error", `Cloudflare said: ${message}.`);
      return envelope;
    }
    throw new ProtoError("cloudflare_api_error");
  }
  async verify() {
    const result = await this.request<{ status: string }>("GET", "/user/tokens/verify");
    if (result.status !== "active") throw new ProtoError("cloudflare_token_invalid");
    return result;
  }
  accounts() { return this.list<Account>("/accounts"); }
  zones(account: string) { return this.list<Zone>(`/zones?account.id=${encodeURIComponent(account)}`); }
  organization(account: string) { return this.request<{ auth_domain: string } | undefined>("GET", `/accounts/${account}/access/organizations`, undefined, true); }
  providers(account: string) { return this.list<{ id: string; type: string }>(`/accounts/${account}/access/identity_providers`); }
  createProvider(account: string) { return this.request<{ id: string }>("POST", `/accounts/${account}/access/identity_providers`, { type: "onetimepin", name: "Email code", config: {} }); }
  tunnels(account: string, name: string) { return this.list<Tunnel>(`/accounts/${account}/cfd_tunnel?name=${encodeURIComponent(name)}&is_deleted=false`); }
  createTunnel(account: string, name: string) { return this.request<Tunnel>("POST", `/accounts/${account}/cfd_tunnel`, { name, config_src: "cloudflare" }); }
  tunnelToken(account: string, tunnel: string) { return this.request<string>("GET", `/accounts/${account}/cfd_tunnel/${tunnel}/token`); }
  tunnel(account: string, tunnel: string) { return this.request<Tunnel | undefined>("GET", `/accounts/${account}/cfd_tunnel/${tunnel}`, undefined, true); }
  records(zone: string, host: string) { return this.list<DnsRecord>(`/zones/${zone}/dns_records?name=${encodeURIComponent(host)}`); }
  createRecord(zone: string, host: string, tunnel: string) { return this.request<DnsRecord>("POST", `/zones/${zone}/dns_records`, { type: "CNAME", name: host, content: `${tunnel}.cfargotunnel.com`, proxied: true }); }
  apps(account: string) { return this.list<AccessApp>(`/accounts/${account}/access/apps`); }
  app(account: string, id: string) { return this.request<AccessApp | undefined>("GET", `/accounts/${account}/access/apps/${id}`, undefined, true); }
  policies(account: string, app: string) { return this.list<Policy>(`/accounts/${account}/access/apps/${app}/policies`); }
}
