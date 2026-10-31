import type { ReviewStorage } from "./storage.ts";
export type Identity = { id: string; name: string; scopes: readonly ("review" | "comment")[] };
export type Principal = Identity & { kind: "reviewer" | "agent"; credentialId: string | null };
export type ReviewServerOptions = {
  storage: ReviewStorage;
  authorize: (request: Request) => Promise<Identity | null>;
  credentialOwner: (ownerId: string) => Promise<Identity | null>;
  signIn: { url: string } | ((request: Request, returnTo: string) => Response | Promise<Response>);
  gallery: { dir: string };
  publicOrigin: string;
  renderOrigin: string;
  basePath?: string;
  ticketSecret: string;
  allowSameSiteRender?: boolean;
  /** I/O seams for deterministic expiry and application logging. */
  clock?: () => number;
  log?: (entry: {
    route: string;
    status: number;
    principal_kind: Principal["kind"] | null;
    duration_ms: number;
  }) => void;
};
