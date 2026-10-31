import { runCli } from "../../../src/cli/main.ts";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import postgres from "postgres";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateRemote, assertSourceReadOnly } from "../../../src/migrate/remote.ts";
import { postgresStorage } from "../../../src/server/postgres.ts";
// Invariants: safe cutover, fingerprints and resumable per-key imports. Owner: migration/Postgres.
describe.skipIf(!process.env.TEST_DATABASE_URL)("UT-084 / IT-031: reloaddev remote cutover", () => {
  let source: postgres.Sql,
    target: postgres.Sql,
    admin: postgres.Sql,
    sourceUrl: string,
    targetUrl: string,
    readOnlyUrl: string,
    directory: string;
  let names: string[], role: string;
  beforeAll(async () => {
    const base = process.env.TEST_DATABASE_URL!;
    admin = postgres(base, { max: 1, onnotice: () => {} });
    names = [
      `it_src_${crypto.randomUUID().replaceAll("-", "")}`,
      `it_dst_${crypto.randomUUID().replaceAll("-", "")}`,
    ];
    for (const name of names) await admin.unsafe(`create database "${name}"`);
    const from = new URL(base);
    from.pathname = `/${names[0]}`;
    sourceUrl = from.href;
    from.searchParams.set("default_transaction_read_only", "on");
    readOnlyUrl = from.href;
    const to = new URL(base);
    to.pathname = `/${names[1]}`;
    targetUrl = to.href;
    source = postgres(sourceUrl, { max: 2, onnotice: () => {} });
    target = postgres(targetUrl, { max: 3, onnotice: () => {} });
    await source.unsafe(
      await readFile(
        new URL("../../fixtures/review/reloaddev-sql/source.sql", import.meta.url),
        "utf8"
      )
    );
    directory = await mkdtemp(join(tmpdir(), "proto-remote-migrate-"));
    role = `it_read_${crypto.randomUUID().replaceAll("-", "")}`;
  });
  afterAll(async () => {
    await source?.end();
    await target?.end();
    for (const name of names ?? [])
      await admin.unsafe(`drop database if exists "${name}" with (force)`);
    if (role) await admin.unsafe(`drop role if exists "${role}"`);
    await admin?.end();
    if (directory) await rm(directory, { recursive: true, force: true });
  });
  beforeEach(async () => {
    await target.unsafe("drop schema public cascade; create schema public");
  });
  const options = () => ({
    fromDatabase: readOnlyUrl,
    toDatabase: targetUrl,
    directory,
    flowPrefix: "fluxo-",
    themeMap: { claro: "light", escuro: "dark" },
    roleMap: { membro: "member" },
  });
  it("UT-084 / IT-031: maps authors, sequence, approvals, bytes and verifies round trips", async () => {
    for (const table of [
      "prototype_reviews",
      "prototype_comments",
      "prototype_messages",
      "prototype_attachments",
    ])
      await source.unsafe(
        `alter table ${table} add column sentinel jsonb default '{"retained":"${table}"}'; alter table ${table} add column extra jsonb default '{"original":true}'`
      );
    const dry = await migrateRemote({ ...options(), dryRun: true });
    expect(dry.errors).toEqual([]);
    expect(dry.keys.every(k => k.status === "planned")).toBe(true);
    expect((await target`select to_regclass('proto_schema') as name`)[0]!.name).toBeNull();
    const cli = await runCli(
      [
        "migrate",
        "remote",
        "--from-database",
        readOnlyUrl,
        "--to-database",
        targetUrl,
        "--flow-prefix",
        "fluxo-",
        "--theme-map",
        "claro=light,escuro=dark",
        "--role-map",
        "membro=member",
        "--json",
      ],
      { cwd: directory }
    );
    expect(cli.exitCode).toBe(0);
    const report = cli.data as Awaited<ReturnType<typeof migrateRemote>>;
    expect(report.errors).toEqual([]);
    expect(report.verified).toBe(true);
    expect(report.sourceUnchanged).toBe(true);
    expect(report.counts.prototype_comments).toMatchObject({
      source: 2,
      target: 2,
      status: "verified",
    });
    expect(report.credentials).toMatchObject({ source: 1, copied: 0 });
    const file = await postgresStorage(target).readKey("flow-cadastro");
    expect(file.extra).toMatchObject({
      legacyRow: { extra: { original: true }, sentinel: { retained: "prototype_reviews" } },
    });
    expect(file.comments[0]!.extra).toMatchObject({
      legacyRow: { extra: { original: true }, sentinel: { retained: "prototype_comments" } },
    });
    expect(file.comments[0]!.thread[0]!.extra).toMatchObject({
      legacyRow: { extra: { original: true }, sentinel: { retained: "prototype_messages" } },
    });
    expect(file.comments[0]!.thread[0]!.attachments[0]!.extra).toMatchObject({
      legacyRow: { extra: { original: true }, sentinel: { retained: "prototype_attachments" } },
    });
    expect(file.sequence).toBe(7);
    expect(file.review.status).toBe("approved");
    expect(file.events[0]).toMatchObject({
      authorId: "u-reviewer",
      authorName: "Fixture Reviewer",
      openCount: 1,
      commit: null,
    });
    expect(file.comments[0]!.context).toMatchObject({ theme: "dark", role: "member" });
    expect(file.comments[0]!.thread[1]).toMatchObject({
      author: "agent",
      authorId: "u-agent",
      authorName: "Fixture Agent Owner",
    });
    expect(report.keys[0]!.openCount).toBe("estimated");
    expect(report.keys[0]!.attachments[0]!.sha256).toMatch(/^[a-f0-9]{64}$/);
    const again = await migrateRemote(options());
    expect(again.errors).toEqual([]);
    expect(again.keys.every(k => k.status === "unchanged")).toBe(true);
    await target`update proto_messages set body='different' where key='flow-cadastro'`;
    const conflict = await migrateRemote(options());
    expect(conflict.errors).toContainEqual({ code: "migration_conflict", key: "flow-cadastro" });
    expect(conflict.keys.find(k => k.key === "login-form")!.status).toBe("unchanged");
  });
  it("IT-031: refuses writable source and accepts a SELECT-only role", async () => {
    const report = await migrateRemote({ ...options(), fromDatabase: sourceUrl });
    expect(report.errors).toContainEqual({ code: "source_not_read_only" });
    await admin.unsafe(`create role "${role}" login password 'fixture-only-password'`);
    await source.unsafe(
      `grant usage on schema public to "${role}"; grant select on all tables in schema public to "${role}"`
    );
    const url = new URL(sourceUrl);
    url.username = role;
    url.password = "fixture-only-password";
    const reader = postgres(url.href, { max: 1 });
    try {
      await expect(assertSourceReadOnly(reader)).resolves.toBeUndefined();
    } finally {
      await reader.end();
    }
    const copied = await migrateRemote({ ...options(), fromDatabase: url.href });
    expect(copied.errors).toEqual([]);
    expect(copied.verified).toBe(true);
  });
  it("IT-031: detects a source edit after the snapshot and stops", async () => {
    await postgresStorage(target).migrate();
    await target.unsafe(
      "create function migration_gate() returns trigger language plpgsql as $$begin perform pg_advisory_xact_lock(891235); return NEW; end$$; create trigger migration_gate before insert on proto_keys for each row execute function migration_gate()"
    );
    const gate = await target.reserve();
    await gate`select pg_advisory_lock(891235)`;
    const running = migrateRemote(options());
    try {
      await expect
        .poll(async () =>
          Number(
            (
              await target`select count(*)::int as count from pg_locks where locktype='advisory' and objid=891235 and not granted`
            )[0]!.count
          )
        )
        .toBeGreaterThan(0);
      await source`update prototype_comments set updated_at=updated_at+interval '1 second' where id='login-form-1'`;
    } finally {
      await gate`select pg_advisory_unlock(891235)`;
      gate.release();
    }
    const report = await running;
    expect(report.errors).toContainEqual({ code: "migration_source_changed" });
    expect(report.verified).toBe(false);
    expect(report.keys).toHaveLength(1);
  });
  it("IT-031: an interrupted key resumes without duplicate rows", async () => {
    await postgresStorage(target).migrate();
    await target.unsafe(
      "create function migration_interrupt() returns trigger language plpgsql as $$begin if NEW.key='login-form' then raise exception 'fixture interruption'; end if; return NEW; end$$; create trigger migration_interrupt before insert on proto_keys for each row execute function migration_interrupt()"
    );
    const interrupted = await migrateRemote(options());
    expect(interrupted.keys.find(k => k.key === "flow-cadastro")!.status).toBe("copied");
    expect(interrupted.verified).toBe(false);
    await target.unsafe("drop trigger migration_interrupt on proto_keys");
    const resumed = await migrateRemote(options());
    expect(resumed.errors).toEqual([]);
    expect(resumed.keys.map(k => k.status)).toEqual(["unchanged", "copied"]);
    expect((await target`select count(*)::int as count from proto_comments`)[0]!.count).toBe(2);
  });
});
