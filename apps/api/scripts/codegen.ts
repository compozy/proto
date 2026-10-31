// Writes the API contract (openapi.json) and the SPA's typed client paths from the route registry.
// `--check` fails when either committed file is stale. No database or network access.
import { createDb } from "@proto/db";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import openapiTS, { astToString } from "openapi-typescript";
import { type FormatConfig, format } from "oxfmt";

import formatConfig from "../../../.oxfmtrc.json";
import { createApp } from "../src/app";
import { loadEnv } from "../src/platform/env";

const root = join(import.meta.dirname, "../../..");
const env = loadEnv({
  DATABASE_URL: "postgres://codegen:codegen@localhost:5432/codegen",
  API_URL: "http://localhost:3001",
  APP_URL: "http://localhost:3002",
  BETTER_AUTH_SECRET: "codegen-isolated-not-a-runtime-secret",
});
const db = createDb(env.DATABASE_URL);
try {
  const document = createApp(db, env).getOpenAPI31Document({
    openapi: "3.1.0",
    info: { title: "Proto API", version: "0.0.0" },
  });
  const json = JSON.stringify(document, null, 2);
  const targets = [
    ["apps/api/openapi.json", json],
    ["apps/app/src/generated/api.d.ts", astToString(await openapiTS(json))],
  ] as const;
  for (const [path, source] of targets) {
    // Mirror the repository EditorConfig JSON indentation.
    const formatted = await format(path, source, {
      ...(formatConfig as FormatConfig),
      tabWidth: path.endsWith(".json") ? 4 : 2,
    });
    if (formatted.errors.length) throw new Error(`Could not format ${path}`);
    const file = join(root, path);
    if (process.argv.includes("--check")) {
      const actual = await readFile(file, "utf8").catch(() => "");
      if (actual !== formatted.code) {
        console.error(`Stale API contract: ${path}. Run bun run codegen.`);
        process.exitCode = 1;
      }
    } else {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, formatted.code);
      console.log(`Generated ${path}`);
    }
  }
} finally {
  await db.$client.end();
}
