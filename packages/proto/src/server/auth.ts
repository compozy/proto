import { createHash } from "node:crypto";
import { ProtoError } from "../model/errors.ts";
import type { ReviewOperation } from "../review/authorization.ts";
import type { ReviewServerOptions, Principal } from "./types.ts";
export const credentialHash = (token: string) => createHash("sha256").update(token).digest("hex");
export function createRemoteAuthorizer(options: ReviewServerOptions) {
  const cache = new WeakMap<Request, Promise<Principal | null>>();
  async function derive(request: Request): Promise<Principal | null> {
    const identity = await options.authorize(request);
    const authorization = request.headers.get("authorization");
    if (identity && authorization) throw new ProtoError("ambiguous_credentials");
    if (authorization) {
      const token = /^Bearer (pcr_[a-f0-9]{64})$/i.exec(authorization)?.[1];
      if (!token) throw new ProtoError("invalid_credential");
      const credential = await options.storage.credentials.find(credentialHash(token));
      if (!credential) throw new ProtoError("invalid_credential");
      if (credential.revokedAt) throw new ProtoError("credential_revoked");
      const owner = await options.credentialOwner(credential.ownerId);
      if (!owner || !owner.scopes.includes("comment")) throw new ProtoError("invalid_credential");
      await options.storage.credentials.used(credential.id);
      return {
        ...owner,
        kind: "agent",
        credentialId: credential.id,
        name: `${owner.name} · ${credential.name}`,
        scopes: ["comment"],
      };
    }
    if (!identity || !identity.scopes.some(scope => scope === "review" || scope === "comment"))
      return null;
    return { ...identity, kind: "reviewer", credentialId: null };
  }
  function principal(request: Request) {
    let result = cache.get(request);
    if (!result) {
      result = derive(request);
      cache.set(request, result);
    }
    return result;
  }
  async function requirePrincipal(request: Request) {
    const value = await principal(request);
    if (!value) throw new ProtoError("auth_required");
    if (
      value.kind === "reviewer" &&
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      (request.headers.get("origin") !== options.publicOrigin ||
        request.headers.get("x-proto-request") !== "1")
    )
      throw new ProtoError("cross_origin_write");
    return value;
  }
  return {
    principal,
    requirePrincipal,
    async authorize(request: Request, operation: ReviewOperation) {
      const value = await requirePrincipal(request);
      if (
        (operation === "review" || operation === "delete") &&
        (value.kind !== "reviewer" || !value.scopes.includes("review"))
      )
        throw new ProtoError("scope_denied");
      return { author: { kind: value.kind, id: value.id, name: value.name } };
    },
  };
}
