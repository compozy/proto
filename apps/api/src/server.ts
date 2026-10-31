import { createDb } from "@proto/db";

import { createApp } from "./app";
import { createAuth } from "./platform/auth";
import { createProtoReview } from "./platform/proto";
import { loadEnv } from "./platform/env";

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
const proto = createProtoReview(db, env, createAuth(db, env));
await proto?.migrate();
const app = createApp(db, env, proto?.fetch);
const server = Bun.serve({ port: env.PORT, fetch: app.fetch });
console.info(`API: ${env.API_URL} (OpenAPI at /openapi.json)`);

async function shutdown() {
  await server.stop();
  await db.$client.end();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
