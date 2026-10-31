// oxlint-disable-next-line no-restricted-imports -- The server entry is the explicitly authorized production adapter, not preview UI.
import { createReviewServer, postgresStorage, type Identity } from "@compozy/proto/server";
import type { Database } from "@proto/db";
import { resolve } from "node:path";
import type { Auth } from "./auth";
import type { ApiEnv } from "./env";
/** Only explicitly allowed email addresses can review; all other accounts remain outside Proto. */
export function createProtoReview(db: Database, env: ApiEnv, auth: Auth) {
  if (!env.PROTO_PUBLIC_ORIGIN || !env.PROTO_RENDER_ORIGIN || !env.PROTO_TICKET_SECRET) return null;
  const allowed = new Set(
    env.PROTO_REVIEW_EMAILS.split(",")
      .map(email => email.trim().toLowerCase())
      .filter(Boolean)
  );
  function identity(
    user: { id: string; name: string; email: string; emailVerified: boolean } | null | undefined
  ): Identity | null {
    return user?.emailVerified === true && allowed.has(user.email.toLowerCase())
      ? { id: user.id, name: user.name, scopes: ["review", "comment"] }
      : null;
  }
  const storage = postgresStorage(db.$client);
  const fetch = createReviewServer({
    storage,
    gallery: { dir: resolve(env.PROTO_GALLERY_DIR) },
    publicOrigin: env.PROTO_PUBLIC_ORIGIN,
    renderOrigin: env.PROTO_RENDER_ORIGIN,
    ticketSecret: env.PROTO_TICKET_SECRET,
    basePath: "/proto/",
    async authorize(request) {
      return identity((await auth.api.getSession({ headers: request.headers }))?.user);
    },
    async credentialOwner(id) {
      return identity(await db.query.user.findFirst({ where: (user, { eq }) => eq(user.id, id) }));
    },
    signIn: { url: new URL("/login", env.APP_URL).href },
  });
  return { fetch, migrate: () => storage.migrate() };
}
