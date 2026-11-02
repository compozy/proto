import { beforeAll, afterAll, describe, it, expect } from "vitest";
import postgres from "postgres";
import { postgresStorage } from "../../../src/server/index.ts";
import { runStoreContract, input, png } from "../store/contract.ts";
import { httpContract, serverHarness, renderOrigin } from "./harness.ts";
// Invariants: transactional store contract, schema gating and conditional claims. Owner: SQL adapter.
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "IT-020 / IT-022: HttpStore + Postgres with session administrative setup",
  () => {
    let sql: postgres.Sql, drop: () => Promise<void>;
    let reads: { queries: number; attachmentBytes: number } | null = null;
    beforeAll(async () => {
      const base = process.env.TEST_DATABASE_URL!;
      const name = `it_proto_${crypto.randomUUID().replaceAll("-", "")}`;
      const admin = postgres(base, { max: 1, onnotice: () => {} });
      await admin.unsafe(`create database "${name}"`);
      await admin.end();
      const url = new URL(base);
      url.pathname = `/${name}`;
      sql = postgres(url.href, {
        max: 6,
        onnotice: () => {},
        debug: () => {
          if (reads) reads.queries++;
        },
        transform: {
          value: {
            from: (value, column) => {
              if (reads && column.name === "data" && value instanceof Uint8Array)
                reads.attachmentBytes += value.byteLength;
              return value;
            },
          },
        },
      });
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
      return httpContract(postgresStorage(sql), true);
    });
    it("listing more review keys keeps database reads bounded and transfers only attachment metadata", async () => {
      // Invariant: collection reads do not create a transaction per key or download image bodies.
      // Owner: SQL adapter; actual queries and decoded bytes from the disposable Postgres database.
      await sql`truncate proto_keys,proto_comments,proto_messages,proto_events,proto_attachments cascade`;
      const store = postgresStorage(sql).store;
      const author = { kind: "reviewer" as const, id: "listing-reviewer" };
      const seed = async (index: number) => {
        const key = `screen-${index}`;
        const upload = await store.upload(key, { name: `${key}.png`, bytes: png }, author);
        const comment = await store.add(
          key,
          { ...input, body: key, attachments: [upload.id] },
          author
        );
        await store.reply(comment.id, { body: `Reply to ${key}` }, author);
      };
      const measure = async () => {
        reads = { queries: 0, attachmentBytes: 0 };
        try {
          return { comments: await store.list({ status: "all" }), ...reads };
        } finally {
          reads = null;
        }
      };
      await seed(0);
      await seed(1);
      const small = await measure();
      for (let index = 2; index < 12; index++) await seed(index);
      const larger = await measure();
      expect(larger.queries).toBeLessThanOrEqual(small.queries + 2);
      expect(larger.attachmentBytes).toBe(0);
      expect(larger.comments).toHaveLength(12);
      for (const comment of larger.comments) {
        expect(comment.thread.map(message => message.body)).toEqual([
          comment.slug,
          `Reply to ${comment.slug}`,
        ]);
        expect(comment.thread[0]!.attachments[0]!.name).toBe(`${comment.slug}.png`);
        expect(comment.thread[1]!.attachments).toEqual([]);
      }
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
          ]) {
            const response = await h.request(path);
            expect(response.status).toBe(503);
            expect(await response.json()).toMatchObject({ error: { code: "schema_mismatch" } });
          }
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
  }
);
