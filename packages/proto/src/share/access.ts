import { createPublicKey, verify, type JsonWebKey, type KeyObject } from "node:crypto";
import { ProtoError } from "../model/errors.ts";
import type { Identity } from "../server/types.ts";

export type Invitee = { email: string; scopes: readonly ("review" | "comment")[] };
type AccessOptions = {
  teamDomain: string;
  audience: string;
  invitees: () => readonly Invitee[];
  fetch?: typeof fetch;
  /** Milliseconds since the Unix epoch, like Date.now. */
  clock?: () => number;
};
type AccessAuthorizer = ((request: Request) => Promise<Identity | null>) & {
  prefetch(): Promise<void>;
};

/** Verify at the origin; Access itself does not assign review permissions. */
export function accessAuthorizer(options: AccessOptions): AccessAuthorizer {
  const issuer = `https://${options.teamDomain}`;
  const fetchKeys = options.fetch ?? globalThis.fetch;
  const clock = options.clock ?? Date.now;
  let keys: Map<string, KeyObject> | undefined;
  let pending: Promise<void> | undefined;
  let lastUnknownRefresh = -Infinity;
  const load = () => {
    pending ??= (async () => {
      const response = await fetchKeys(`${issuer}/cdn-cgi/access/certs`, {
        signal: AbortSignal.timeout(5000),
        redirect: "error",
      });
      if (!response.ok) throw new Error("Signing keys unavailable");
      const jwks = (await response.json()) as { keys?: (JsonWebKey & { kid?: string })[] };
      if (!Array.isArray(jwks.keys)) throw new Error("Invalid signing keys");
      const next = new Map<string, KeyObject>();
      for (const key of jwks.keys) {
        if (key.kty !== "RSA" || !key.kid || (key.alg && key.alg !== "RS256")) continue;
        if (key.use && key.use !== "sig") continue;
        next.set(key.kid, createPublicKey({ key, format: "jwk" }));
      }
      if (!next.size) throw new Error("No RSA signing keys");
      keys = next;
    })().finally(() => {
      pending = undefined;
    });
    return pending;
  };
  const authorize = async (request: Request): Promise<Identity | null> => {
    const token = request.headers.get("Cf-Access-Jwt-Assertion");
    if (!token) return null;
    try {
      const parts = token.split(".");
      if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return null;
      const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];
      const header = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8"));
      if (header.alg !== "RS256" || typeof header.kid !== "string" || !header.kid) return null;
      if (!keys) await load();
      else if (!keys.has(header.kid)) {
        if (pending) await pending;
        else if (clock() - lastUnknownRefresh >= 60_000) {
          lastUnknownRefresh = clock();
          await load();
        }
      }
      const key = keys?.get(header.kid);
      if (
        !key ||
        !verify(
          "RSA-SHA256",
          Buffer.from(`${headerPart}.${payloadPart}`),
          key,
          Buffer.from(signaturePart, "base64url")
        )
      )
        return null;
      const claims = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
      const now = clock() / 1000;
      if (
        claims.iss !== issuer ||
        !Array.isArray(claims.aud) ||
        !claims.aud.includes(options.audience) ||
        typeof claims.exp !== "number" ||
        !Number.isFinite(claims.exp) ||
        claims.exp <= now ||
        typeof claims.nbf !== "number" ||
        !Number.isFinite(claims.nbf) ||
        claims.nbf > now ||
        typeof claims.email !== "string" ||
        !claims.email.trim()
      )
        return null;
      const email = claims.email.toLowerCase();
      const invitee = options.invitees().find(person => person.email.toLowerCase() === email);
      return invitee ? { id: email, name: email, scopes: [...invitee.scopes] } : null;
    } catch {
      return null;
    }
  };
  return Object.assign(authorize, {
    async prefetch() {
      try {
        await load();
      } catch {
        throw new ProtoError(
          "cloudflare_api_error",
          "Cloudflare said: could not fetch Access signing keys."
        );
      }
    },
  });
}

/** Call before starting the tunnel. The returned authorizer retains the prefetched keys. */
export async function prefetchAccessAuthorizer(options: AccessOptions): Promise<AccessAuthorizer> {
  const authorize = accessAuthorizer(options);
  await authorize.prefetch();
  return authorize;
}
