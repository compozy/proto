import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema/index.ts";

/**
 * Opens a Drizzle client. postgres.js connects lazily, so creating a client never touches the
 * network. Prepared statements stay off for transaction poolers (Neon, PgBouncer); serverless
 * callers pass `max: 1`.
 */
export function createDb(connectionString: string, options: { max?: number } = {}) {
  const client = postgres(connectionString, {
    max: options.max ?? 10,
    prepare: false,
    connect_timeout: 5,
    onnotice: () => {},
  });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
