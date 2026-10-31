import type { Database } from "@proto/db";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

import { meRoutes } from "./modules/me/routes";
import { createAuth } from "./platform/auth";
import type { ApiEnv } from "./platform/env";
import { DomainError } from "./platform/errors";
import type { HttpEnv } from "./platform/http";

export function createApp(db: Database, env: ApiEnv) {
  const auth = createAuth(db, env);
  const app = new OpenAPIHono<HttpEnv>({
    defaultHook: (result, c) => {
      if (!result.success) return c.json({ code: "invalid_input" }, 422);
    },
  });

  app.use("*", secureHeaders());
  app.use(
    "*",
    cors({
      origin: origin => (origin === env.APP_URL ? origin : undefined),
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type"],
    })
  );
  app.onError((error, c) => {
    if (error instanceof DomainError) return c.json({ code: error.code }, error.status);
    console.error(error);
    return c.json({ code: "internal_error" }, 500);
  });
  app.notFound(c => c.json({ code: "not_found" }, 404));

  app.get("/health", c => c.json({ ok: true }));
  app.on(["GET", "POST"], "/auth/*", c => auth.handler(c.req.raw));
  app.route("/v1", meRoutes(auth));

  app.doc31("/openapi.json", { openapi: "3.1.0", info: { title: "Proto API", version: "0.0.0" } });
  return app;
}
