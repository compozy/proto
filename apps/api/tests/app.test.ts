// Invariant: health is public, `/v1/*` rejects requests without a session, and the published
// contract lists every route. Owner: @proto/api (HTTP surface).
import { createDb } from "@proto/db";
import { afterAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app";
import { loadEnv } from "../src/platform/env";

const env = loadEnv({
  DATABASE_URL: "postgres://test:test@localhost:5432/unused",
  API_URL: "http://localhost:3001",
  APP_URL: "http://localhost:3002",
  BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
});
const db = createDb(env.DATABASE_URL);
const app = createApp(db, env);
afterAll(() => db.$client.end());

describe("api", () => {
  it("serves health without a session", async () => {
    const response = await app.request("/health");
    expect(response.status).toBe(200);
  });

  it("rejects /v1/me without a session", async () => {
    const response = await app.request("/v1/me");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: "unauthorized" });
  });

  it("publishes the routes in the OpenAPI document", async () => {
    const document = await (await app.request("/openapi.json")).json();
    expect(Object.keys(document.paths)).toContain("/v1/me");
  });
});
