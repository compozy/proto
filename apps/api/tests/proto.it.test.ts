// Invariant: Better Auth identity/allowlist, Hono mount and render dispatch compose without CORS.
// Owner: API integration; disposable database like the existing db harness.
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createTestDatabase } from "@proto/db/testing";
import { createApp } from "../src/app";
import { createAuth } from "../src/platform/auth";
import { createProtoReview } from "../src/platform/proto";
import { loadEnv } from "../src/platform/env";
import { serverHarness } from "../../../packages/proto/test/node/server/harness.ts";
describe.skipIf(!process.env.TEST_DATABASE_URL)("Proto API integration", () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let fixture: Awaited<ReturnType<typeof serverHarness>>;
  beforeAll(async () => {
    database = await createTestDatabase();
    fixture = await serverHarness();
  });
  afterAll(async () => {
    await fixture?.dispose();
    await database?.drop();
  });
  it("IT-024/032: real session authorizes allowed users and never reaches auth on render", async () => {
    const env = loadEnv({
      DATABASE_URL: database.url,
      API_URL: "https://gallery.example.com",
      APP_URL: "https://gallery.example.com",
      BETTER_AUTH_SECRET: "test-secret-at-least-thirty-two-characters",
      PROTO_PUBLIC_ORIGIN: "https://gallery.example.com",
      PROTO_RENDER_ORIGIN: "https://render.example.net",
      PROTO_TICKET_SECRET: "s".repeat(32),
      PROTO_REVIEW_EMAILS: "review@example.com",
      PROTO_GALLERY_DIR: fixture.options.gallery.dir,
      NODE_ENV: "production",
    });
    const auth = createAuth(database.db, env);
    const proto = createProtoReview(database.db, env, auth)!;
    await proto.migrate();
    const app = createApp(database.db, env, proto.fetch);
    const signup = await auth.handler(
      new Request(`${env.API_URL}/auth/sign-up/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: env.APP_URL },
        body: JSON.stringify({
          email: "review@example.com",
          password: "test-password-strong",
          name: "Reviewer",
        }),
      })
    );
    expect(signup.status).toBe(200);
    const cookies = signup.headers.getSetCookie();
    expect(cookies.join(";")).toContain("Secure");
    expect(cookies.join(";")).toContain("HttpOnly");
    expect(cookies.join(";")).not.toMatch(/Domain=/i);
    const cookie = cookies.map(c => c.split(";")[0]).join("; ");
    const session = await app.request(`${env.PROTO_PUBLIC_ORIGIN}/proto/api/session`, {
      headers: { cookie },
    });
    expect(session.status).toBe(200);
    expect((await session.json()).principal).toMatchObject({
      kind: "reviewer",
      scopes: ["review", "comment"],
    });
    const denied = await app.request(`${env.PROTO_PUBLIC_ORIGIN}/proto/api/credentials`, {
      method: "POST",
      headers: { cookie, origin: "https://evil.test", "content-type": "application/json" },
      body: JSON.stringify({ name: "forged" }),
    });
    expect(denied.status).toBe(403);
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
    const render = await app.request(`${env.PROTO_RENDER_ORIGIN}/auth/get-session`, {
      headers: { cookie },
    });
    expect(render.status).toBe(401);
    expect(await render.text()).toContain("auth:expired");
    const document = await app.request(`${env.PROTO_PUBLIC_ORIGIN}/openapi.json`);
    expect(Object.keys((await document.json()).paths).some(path => path.startsWith("/proto"))).toBe(
      false
    );
  });
});
