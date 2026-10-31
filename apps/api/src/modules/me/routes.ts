import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import type { Auth } from "../../platform/auth";
import { type HttpEnv, requireSession, responses } from "../../platform/http";

const meSchema = z.object({ id: z.string(), name: z.string(), email: z.email() }).openapi("Me");

const getMe = createRoute({
  method: "get",
  path: "/me",
  tags: ["me"],
  responses: responses(meSchema),
});

export function meRoutes(auth: Auth) {
  const routes = new OpenAPIHono<HttpEnv>();
  routes.use("/me", requireSession(auth));
  return routes.openapi(getMe, c => c.json(c.var.user, 200));
}
