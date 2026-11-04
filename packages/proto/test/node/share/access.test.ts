import { createHash, createHmac, generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  accessAuthorizer,
  prefetchAccessAuthorizer,
  type Invitee,
} from "../../../src/share/access.ts";
import { notInvitedPage } from "../../../src/share/pages.ts";
import type { ReviewServerOptions } from "../../../src/server/types.ts";

const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
const now = 1_800_000_000_000;
const claims = {
  iss: "https://team.cloudflareaccess.com",
  aud: ["app"],
  exp: now / 1000 + 60,
  nbf: now / 1000 - 60,
  email: "Ana@Acme.com",
};
const jwk = (kid: string) => ({ ...pair.publicKey.export({ format: "jwk" }), kid, alg: "RS256" });
function token(
  payload: Record<string, unknown> = claims,
  kid = "one",
  key = pair.privateKey,
  alg = "RS256"
) {
  const data = [{ alg, kid }, payload]
    .map(value => Buffer.from(JSON.stringify(value)).toString("base64url"))
    .join(".");
  return `${data}.${sign("RSA-SHA256", Buffer.from(data), key).toString("base64url")}`;
}
const request = (jwt: string) =>
  new Request("https://proto.example.com", {
    headers: { "Cf-Access-Jwt-Assertion": jwt },
  });
function setup() {
  let invitees: readonly Invitee[] = [{ email: "ana@acme.com", scopes: ["review", "comment"] }];
  const fetchKeys = vi.fn<typeof fetch>(async () => Response.json({ keys: [jwk("one")] }));
  let time = now;
  const options = {
    teamDomain: "team.cloudflareaccess.com",
    audience: "app",
    fetch: fetchKeys,
    clock: () => time,
    invitees: () => invitees,
  };
  return {
    options,
    authorize: accessAuthorizer(options),
    fetchKeys,
    invite: (people: readonly Invitee[]) => {
      invitees = people;
    },
    advance: (ms: number) => {
      time += ms;
    },
  };
}

// Invariant: only a verified, currently invited email supplies identity and scopes.
// Owner: share Access authorization; canonical suite: node/share/access.test.ts.
describe("Access identity", () => {
  it("UT-005: verified email is normalized for both identity fields", async () => {
    const h = setup();
    expect(await h.authorize(request(token()))).toEqual({
      id: "ana@acme.com",
      name: "ana@acme.com",
      scopes: ["review", "comment"],
    });
    expect(h.fetchKeys).toHaveBeenCalledWith(
      "https://team.cloudflareaccess.com/cdn-cgi/access/certs",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
  it("UT-006: forged signatures and algorithm confusion never authenticate", async () => {
    const h = setup();
    const data = [{ alg: "HS256", kid: "one" }, claims]
      .map(value => Buffer.from(JSON.stringify(value)).toString("base64url"))
      .join(".");
    const hmac = createHmac("sha256", pair.publicKey.export({ format: "pem", type: "spki" }))
      .update(data)
      .digest("base64url");
    for (const jwt of [
      token(claims, "one", other.privateKey),
      token(claims, "one", pair.privateKey, "none"),
      `${data}.${hmac}`,
      "broken",
      "null.e30.eA",
    ])
      expect(await h.authorize(request(jwt))).toBeNull();
  });
  it("UT-007: issuer, audience and time bounds are mandatory", async () => {
    const h = setup();
    for (const change of [
      { aud: ["other"] },
      { aud: "app" },
      { iss: "https://other" },
      { exp: now / 1000 - 1 },
      { exp: now / 1000 },
      { exp: undefined },
      { nbf: now / 1000 + 1 },
      { nbf: "yesterday" },
    ])
      expect(await h.authorize(request(token({ ...claims, ...change })))).toBeNull();
  });
  it("UT-008: rotated keys refresh once per minute and concurrent requests share the fetch", async () => {
    const h = setup();
    const authorize = await prefetchAccessAuthorizer(h.options);
    h.fetchKeys.mockImplementation(async () => Response.json({ keys: [jwk("two")] }));
    const jwt = token({ ...claims, exp: now / 1000 + 300 }, "two");
    expect((await authorize(request(jwt)))?.id).toBe("ana@acme.com");
    expect(await authorize(request(token(claims, "three")))).toBeNull();
    expect(h.fetchKeys).toHaveBeenCalledTimes(2);
    h.advance(60_000);
    h.fetchKeys.mockImplementation(async () => Response.json({ keys: [jwk("three")] }));
    const rotated = token({ ...claims, exp: now / 1000 + 300 }, "three");
    const results = await Promise.all([authorize(request(rotated)), authorize(request(rotated))]);
    expect(results.map(result => result?.id)).toEqual(["ana@acme.com", "ana@acme.com"]);
    expect((await authorize(request(rotated)))?.id).toBe("ana@acme.com");
    expect(h.fetchKeys).toHaveBeenCalledTimes(3);
  });
  it("UT-009: missing assertion does not fetch keys", async () => {
    const h = setup();
    expect(await h.authorize(new Request("https://proto.example.com"))).toBeNull();
    expect(h.fetchKeys).not.toHaveBeenCalled();
  });
  it("UT-010: every request rechecks invitations and current scopes", async () => {
    const h = setup();
    const jwt = request(token());
    expect(await h.authorize(jwt)).not.toBeNull();
    h.invite([]);
    expect(await h.authorize(jwt)).toBeNull();
    h.invite([{ email: "ANA@ACME.COM", scopes: ["comment"] }]);
    expect((await h.authorize(jwt))?.scopes).toEqual(["comment"]);
  });
  it("UT-016: service tokens and empty emails supply no principal", async () => {
    const h = setup();
    for (const email of [undefined, "", "  ", 42])
      expect(await h.authorize(request(token({ ...claims, email })))).toBeNull();
  });
  it("UT-016: key timeouts fail closed during a session and fail startup explicitly", async () => {
    // AbortSignal.timeout is runtime-owned; the fetch boundary simulates its timeout rejection.
    const h = setup();
    const authorize = await prefetchAccessAuthorizer(h.options);
    h.fetchKeys.mockRejectedValue(new DOMException("Timed out", "TimeoutError"));
    expect(await authorize(request(token(claims, "rotated")))).toBeNull();
    await expect(prefetchAccessAuthorizer(h.options)).rejects.toMatchObject({
      code: "cloudflare_api_error",
      exit: 4,
    });
    expect(h.fetchKeys).toHaveBeenCalledTimes(3);
  });
  it("S2: denied sign-in is a localized 403 with no reflected gallery or return URL", async () => {
    for (const locale of ["en", "pt-BR"] as const) {
      const page: Exclude<ReviewServerOptions["signIn"], { url: string }> = notInvitedPage(locale);
      const response = await page(
        new Request("https://proto.example.com/?p=private"),
        "<script>private</script>"
      );
      expect(response.status).toBe(403);
      expect(response.headers.get("Content-Type")).toContain("text/html");
      const html = await response.text();
      expect(html).toContain(`lang="${locale}"`);
      expect(html).toContain(
        locale === "en" ? "This email was not invited" : "Este e-mail não foi convidado"
      );
      expect(html).not.toContain("private");
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      // The page is self-contained: its only inline style block is allowed by hash, nothing loads.
      const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(match => match[1]);
      expect(styles).toHaveLength(1);
      const hash = createHash("sha256")
        .update(styles[0] ?? "")
        .digest("base64");
      const csp = response.headers.get("Content-Security-Policy") ?? "";
      expect(csp).toContain("default-src 'none'");
      expect(csp).toContain(`style-src 'sha256-${hash}'`);
      expect(html).not.toMatch(/https?:\/\/|\/\/[a-z]|<script|<link|<img|src=|url\(|@import/i);
      expect(html.match(/<h1>/g)).toHaveLength(1);
      expect(html).toContain("<main>");
    }
  });
});
