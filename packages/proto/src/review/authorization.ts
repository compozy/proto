import { ProtoError } from "../model/errors.ts";
import type { Author } from "../model/review.ts";
export type ReviewOperation = "read" | "comment" | "edit" | "delete" | "review";
/** Remote hosts derive author from sessions/bearers and enforce their matrix here. */
export type ReviewAuthorizer = (
  request: Request,
  operation: ReviewOperation
) => Promise<{ author: Author } | Response>;
export type DevAuthorizerOptions = { shellOrigin: string; allowedHosts?: readonly string[] };
export function createDevAuthorizer(options: DevAuthorizerOptions): ReviewAuthorizer {
  const canonical = new URL(options.shellOrigin);
  const hosts = new Set([
    canonical.host,
    `localhost${canonical.port ? `:${canonical.port}` : ""}`,
    ...(options.allowedHosts ?? []).map(
      host => `${host}${canonical.port ? `:${canonical.port}` : ""}`
    ),
  ]);
  return async request => {
    const host = request.headers.get("host") ?? new URL(request.url).host;
    if (!hosts.has(host)) throw new ProtoError("host_not_allowed");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      request.headers.get("origin") !== canonical.origin
    )
      throw new ProtoError("cross_origin_write");
    if (
      host === `localhost${canonical.port ? `:${canonical.port}` : ""}` &&
      ["GET", "HEAD"].includes(request.method)
    ) {
      const url = new URL(request.url);
      url.host = canonical.host;
      url.protocol = canonical.protocol;
      return Response.redirect(url, 307);
    }
    return { author: { kind: "reviewer" } };
  };
}
