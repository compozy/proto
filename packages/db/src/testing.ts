// Integration-test harness: one disposable PostgreSQL database per suite, migrated with the
// committed migrations. Gate suites with `describe.skipIf(!process.env.TEST_DATABASE_URL)` and
// name them `*.it.test.ts`. TEST_DATABASE_URL only names the server (and an admin database to
// connect to); each suite gets its own `it_*` database, so parallel suites never share state.
// Never point TEST_DATABASE_URL at a real database.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

import type { Database } from "./client.ts";
import * as schema from "./schema/index.ts";

export const MIGRATIONS_FOLDER = fileURLToPath(new URL("../drizzle", import.meta.url));

export interface TestDatabase {
  db: Database;
  /** Raw postgres.js client of the suite database (for raw SQL assertions). */
  sql: postgres.Sql;
  /** Connection string of the suite database (for code that opens its own connections). */
  url: string;
  /** Close connections and drop the suite database. Call in `afterAll`. */
  drop: () => Promise<void>;
}

function adminUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set");
  return url;
}

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

/** Content hash of the committed migrations: a changed migration set gets a fresh template. */
function migrationsFingerprint(): string {
  const hash = createHash("sha256");
  for (const file of readdirSync(MIGRATIONS_FOLDER, { recursive: true }).map(String).sort()) {
    if (file.endsWith(".sql") || file.endsWith(".json"))
      hash.update(file).update(readFileSync(join(MIGRATIONS_FOLDER, file)));
  }
  return hash.digest("hex").slice(0, 16);
}

/** Migrate once per migration set into a template database, then clone it per suite. */
async function ensureMigratedTemplate(admin: postgres.Sql, base: string): Promise<string> {
  const template = `it_tpl_${migrationsFingerprint()}`;
  await admin`select pg_advisory_lock(hashtextextended(${template}, 0))`;
  try {
    const [found] = await admin`select 1 from pg_database where datname = ${template}`;
    if (found) return template;
    const building = `${template}_building`;
    await admin.unsafe(`drop database if exists "${building}" with (force)`);
    await admin.unsafe(`create database "${building}"`);
    const sql = postgres(withDatabase(base, building), { max: 1, onnotice: () => {} });
    try {
      await migrate(drizzle(sql, { schema }), { migrationsFolder: MIGRATIONS_FOLDER });
    } finally {
      await sql.end();
    }
    // The rename publishes a fully migrated template atomically.
    await admin.unsafe(`alter database "${building}" rename to "${template}"`);
    return template;
  } finally {
    await admin`select pg_advisory_unlock(hashtextextended(${template}, 0))`;
  }
}

/** Create a fresh database on the TEST_DATABASE_URL server with the committed migrations applied. */
export async function createTestDatabase(options: { max?: number } = {}): Promise<TestDatabase> {
  const base = adminUrl();
  const name = `it_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const admin = postgres(base, { max: 1, onnotice: () => {} });
  try {
    const template = await ensureMigratedTemplate(admin, base);
    await admin.unsafe(`create database "${name}" template "${template}"`);
  } finally {
    await admin.end();
  }

  const url = withDatabase(base, name);
  const sql = postgres(url, { max: options.max ?? 4, onnotice: () => {} });
  const db = drizzle(sql, { schema });

  return {
    db,
    sql,
    url,
    drop: async () => {
      await sql.end({ timeout: 5 });
      const cleanup = postgres(base, { max: 1, onnotice: () => {} });
      try {
        await cleanup.unsafe(`drop database if exists "${name}" with (force)`);
      } finally {
        await cleanup.end();
      }
    },
  };
}
