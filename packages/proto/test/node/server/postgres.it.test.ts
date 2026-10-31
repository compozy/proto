import { beforeAll, afterAll, describe, it, expect } from "vitest";
import postgres from "postgres";
import { postgresStorage } from "../../../src/server/index.ts";
import { runStoreContract, input, png } from "../store/contract.ts";
import { httpContract, serverHarness, renderOrigin } from "./harness.ts";
// Invariants: transactional store contract, schema gating and conditional claims. Owner: SQL adapter.
describe.skipIf(!process.env.TEST_DATABASE_URL)("IT-020: Postgres over HTTP", () => {
  let sql: postgres.Sql, drop: () => Promise<void>;
  beforeAll(async () => {
    const base = process.env.TEST_DATABASE_URL!;
    const name = `it_proto_${crypto.randomUUID().replaceAll("-", "")}`;
    const admin = postgres(base, { max: 1, onnotice: () => {} });
    await admin.unsafe(`create database "${name}"`);
    await admin.end();
    const url = new URL(base);
    url.pathname = `/${name}`;
    sql = postgres(url.href, { max: 6, onnotice: () => {} });
    drop = async () => {
      await sql.end();
      const cleanup = postgres(base, { max: 1, onnotice: () => {} });
      try {
        await cleanup.unsafe(`drop database "${name}" with (force)`);
      } finally {
        await cleanup.end();
      }
    };
    await Promise.all([postgresStorage(sql).migrate(), postgresStorage(sql).migrate()]);
  });
  afterAll(async () => {
    await drop?.();
  });
  runStoreContract(async () => {
    await sql`truncate proto_keys,proto_comments,proto_messages,proto_events,proto_attachments,proto_credentials cascade`;
    return httpContract(postgresStorage(sql));
  });
  it("UT-074: every route refuses older/newer DDL; concurrent migrations apply once", async () => {
    expect(await sql`select version from proto_schema`).toHaveLength(1);
    const h = await serverHarness(postgresStorage(sql));
    try {
      for (const version of [0, 2]) {
        await sql`update proto_schema set version=${version}`;
        for (const path of [
          "",
          "sign-in",
          "__proto/bootstrap.json",
          "api/session",
          "api/comments",
          `${renderOrigin}/__proto/render/login-form`,
        ])
          expect(await (await h.request(path)).json()).toMatchObject({
            error: { code: "schema_mismatch" },
          });
      }
    } finally {
      await sql`update proto_schema set version=1`;
      await h.dispose();
    }
  });
  it("UT-071: conditional claim and failed mutation roll back all rows", async () => {
    await sql`truncate proto_keys,proto_comments,proto_messages,proto_events,proto_attachments cascade`;
    const store = postgresStorage(sql).store,
      author = { kind: "reviewer" as const, id: "person" };
    const pending = await store.upload("login-form", { name: "a.png", bytes: png }, author);
    const result = await Promise.allSettled([
      store.add("login-form", { ...input, attachments: [pending.id] }, author),
      store.add("login-form", { ...input, attachments: [pending.id] }, author),
    ]);
    expect(result.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(await sql`select * from proto_comments where key='login-form'`).toHaveLength(1);
    expect(
      (await sql`select message_id from proto_attachments where id=${pending.id}`)[0]!.message_id
    ).not.toBeNull();
  });
});
