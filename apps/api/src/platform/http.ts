import { z } from "@hono/zod-openapi";
import { createMiddleware } from "hono/factory";

import type { Auth } from "./auth";
import { DomainError } from "./errors";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

export type HttpEnv = { Variables: { user: SessionUser } };

export const errorSchema = z.object({ code: z.string() }).openapi("ApiError");

export const jsonContent = <T extends z.ZodType>(schema: T) => ({ "application/json": { schema } });

/** Standard responses for an authenticated JSON route. */
export const responses = <T extends z.ZodType>(schema: T) => ({
  200: { description: "Success", content: jsonContent(schema) },
  401: { description: "No session", content: jsonContent(errorSchema) },
  422: { description: "Invalid input", content: jsonContent(errorSchema) },
});

/** Rejects requests without a session and exposes the user as `c.var.user`. */
export const requireSession = (auth: Auth) =>
  createMiddleware<HttpEnv>(async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) throw new DomainError("unauthorized", 401);
    const { id, name, email } = session.user;
    c.set("user", { id, name, email });
    await next();
  });
