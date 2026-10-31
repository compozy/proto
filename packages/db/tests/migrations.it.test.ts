// Invariant: the committed migrations apply to an empty database and create the auth tables.
// Owner: @proto/db.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDatabase, type TestDatabase } from "../src/testing.ts";

describe.skipIf(!process.env.TEST_DATABASE_URL)("migrations", () => {
  let database: TestDatabase;
  beforeAll(async () => {
    database = await createTestDatabase();
  });
  afterAll(() => database?.drop());

  it("creates the auth tables", async () => {
    const rows = await database.sql<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema = 'public' order by table_name`;
    expect(rows.map(row => row.table_name)).toEqual(
      expect.arrayContaining(["account", "session", "user", "verification"])
    );
  });
});
