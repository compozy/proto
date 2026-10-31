import { isDeepStrictEqual } from "node:util";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import type { Sql } from "postgres";
import { postgresStorage, type ImportedAttachment } from "../server/postgres.ts";
import { ProtoError, type ErrorCode } from "../model/errors.ts";
import { upgradeReviewFile, type UpgradeOptions } from "../model/upgrade.ts";
import { atomicWrite } from "../store/file-store.ts";
const tables = [
  "prototype_reviews",
  "prototype_comments",
  "prototype_messages",
  "prototype_attachments",
  "prototype_credentials",
] as const;
type Row = Record<string, any>;
export type RemoteSource = Record<(typeof tables)[number], Row[]> & { users: Row[] };
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const at = (value: Date | string | null) => (value == null ? null : new Date(value).toISOString());
function stableId(value: string) {
  const h = hash(value);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
/** Pure reloaddev row mapping, reusing the lossless file upgrader. */
export function upgradeRemoteKey(source: RemoteSource, review: Row, options: UpgradeOptions = {}) {
  const users = new Map(source.users.map(user => [user.id, user.name]));
  const attachments: ImportedAttachment[] = [];
  const messages = source.prototype_messages;
  const comments = source.prototype_comments
    .filter(c => c.slug === review.slug)
    .sort(
      (a, b) =>
        Number(a.id.slice(review.slug.length + 1)) - Number(b.id.slice(review.slug.length + 1))
    )
    .map(c => ({
      id: c.id,
      slug: c.slug,
      status: c.status,
      createdAt: at(c.created_at),
      updatedAt: at(c.updated_at),
      resolvedAt: at(c.resolved_at),
      context: c.context,
      target: c.target,
      thread: messages
        .filter(m => m.comment_id === c.id)
        .sort(
          (a, b) => String(at(a.at)).localeCompare(String(at(b.at))) || a.id.localeCompare(b.id)
        )
        .map(m => ({
          id: m.id,
          at: at(m.at),
          editedAt: at(m.edited_at),
          body: m.body,
          author: m.author,
          ...(m.author_id
            ? { authorId: m.author_id, authorName: users.get(m.author_id) ?? "Unknown user" }
            : {}),
          attachments: source.prototype_attachments
            .filter(a => a.message_id === m.id)
            .sort(
              (a, b) =>
                String(at(a.created_at)).localeCompare(String(at(b.created_at))) ||
                a.id.localeCompare(b.id)
            )
            .map(a => {
              const bytes = new Uint8Array(a.bytes);
              attachments.push({ id: a.id, bytes, createdAt: at(a.created_at)! });
              return {
                id: a.id,
                name: a.name,
                type: a.type,
                size: a.size,
                width: a.width,
                height: a.height,
                uploaderId: a.uploader_id,
                uploaderKind: m.author,
              };
            }),
        })),
    }));
  const upgraded = upgradeReviewFile(
    { version: 2, slug: review.slug, sequence: review.next_comment - 1, comments },
    options
  );
  if (!upgraded.ok)
    throw new ProtoError("migration_unverified", "Legacy review data could not be validated.");
  const file = upgraded.file;
  if (review.approved_at) {
    const timestamp = at(review.approved_at)!;
    file.review = { status: "approved", updatedAt: timestamp };
    file.events = [
      {
        id: stableId(`reloaddev:${review.slug}:${timestamp}`),
        type: "approved",
        at: timestamp,
        author: "reviewer",
        ...(review.approved_by
          ? {
              authorId: review.approved_by,
              authorName: users.get(review.approved_by) ?? "Unknown user",
            }
          : {}),
        commit: null,
        openCount: file.comments.filter(c => c.status === "open").length,
      },
    ];
  }
  return {
    file,
    attachments,
    rewrites: upgraded.rewrites,
    openCount: review.approved_at ? ("estimated" as const) : null,
  };
}
async function readSource(sql: Sql): Promise<RemoteSource> {
  return (await sql.begin("isolation level repeatable read read only", async tx => {
    const source: Record<string, Row[]> = {};
    for (const table of tables)
      source[table] =
        table === "prototype_credentials"
          ? await tx`select id,user_id,created_at,encode(sha256(convert_to(token_hash,'UTF8')),'hex') as token_hash_fingerprint from prototype_credentials order by id`
          : await tx.unsafe(
              `select * from ${table} order by ${table === "prototype_reviews" ? "slug" : "id"}`
            );
    source.users = await tx`select id,name,updated_at from "user" order by id`;
    return source as RemoteSource;
  })) as RemoteSource;
}
export function sourceFingerprint(source: RemoteSource) {
  return Object.fromEntries(
    Object.entries(source).map(([table, rows]) => [
      table,
      {
        count: rows.length,
        maxUpdatedAt: rows.reduce<string | null>((last, row) => {
          const value = at(row.updated_at ?? null);
          return value && (!last || value > last) ? value : last;
        }, null),
        sha256: hash(JSON.stringify(rows)),
      },
    ])
  );
}
/** Zero-row UPDATE still checks write permissions/read-only mode, and never changes source data. */
export async function assertSourceReadOnly(sql: Sql) {
  for (const table of tables) {
    let denied = false;
    try {
      await sql.begin(async tx => {
        await tx.unsafe(
          `update ${table} set ${table === "prototype_reviews" ? "next_comment=next_comment" : "id=id"} where false`
        );
      });
    } catch (error) {
      if (["25006", "42501"].includes((error as { code: string }).code)) denied = true;
      else throw error;
    }
    if (!denied) throw new ProtoError("source_not_read_only");
  }
}
export type RemoteMigrationOptions = UpgradeOptions & {
  fromDatabase: string;
  toDatabase: string;
  directory?: string;
  dryRun?: boolean;
};
export type RemoteMigrationReport = {
  version: 1;
  kind: "remote";
  dryRun: boolean;
  sourceReadOnly: boolean;
  sourceUnchanged: boolean;
  verified: boolean;
  fingerprint: ReturnType<typeof sourceFingerprint> | null;
  keys: {
    sourceKey: string;
    key: string;
    status: "copied" | "unchanged" | "planned" | "conflict" | "failed";
    comments: number;
    verifiedComments: { id: string; verified: boolean }[];
    messages: number;
    sequence: number;
    openCount: "estimated" | null;
    attachments: { id: string; size: number; sha256: string }[];
    rewrites: unknown[];
  }[];
  counts: Record<string, { source: number; target: number; status: string }>;
  credentials: { source: number; copied: 0; note: string };
  errors: { code: ErrorCode; key?: string }[];
};
export async function migrateRemote(
  options: RemoteMigrationOptions
): Promise<RemoteMigrationReport> {
  const { default: postgres } = await import("postgres");
  let source: Sql | undefined, target: Sql | undefined;
  const report: RemoteMigrationReport = {
    version: 1,
    kind: "remote",
    dryRun: !!options.dryRun,
    sourceReadOnly: false,
    sourceUnchanged: false,
    verified: false,
    fingerprint: null,
    keys: [],
    counts: {},
    credentials: {
      source: 0,
      copied: 0,
      note: "Not copied: owners must re-issue rpc_ credentials as pcr_ credentials.",
    },
    errors: [],
  };
  try {
    if (options.fromDatabase === options.toDatabase)
      throw new ProtoError("invalid_input", "Source and target must differ.");
    source = postgres(options.fromDatabase, { max: 1, connect_timeout: 5, onnotice: () => {} });
    target = postgres(options.toDatabase, { max: 2, connect_timeout: 5, onnotice: () => {} });
    await assertSourceReadOnly(source);
    report.sourceReadOnly = true;
    const snapshot = await readSource(source);
    report.fingerprint = sourceFingerprint(snapshot);
    report.credentials.source = snapshot.prototype_credentials.length;
    // Pending images have no key in reloaddev. Drain/discard them before a verified cutover.
    if (snapshot.prototype_attachments.some(a => a.message_id === null))
      throw new ProtoError(
        "migration_unverified",
        "Pending legacy uploads must be drained before cutover."
      );
    const storage = postgresStorage(target);
    if (!options.dryRun) await storage.migrate();
    let targetReady = true;
    try {
      await storage.checkSchema();
    } catch (error) {
      if (options.dryRun && error instanceof ProtoError && error.code === "schema_mismatch")
        targetReady = false;
      else throw error;
    }
    const seen = new Set<string>();
    for (const review of snapshot.prototype_reviews) {
      const upgraded = upgradeRemoteKey(snapshot, review, options),
        { file, attachments } = upgraded;
      const record: RemoteMigrationReport["keys"][number] = {
        sourceKey: review.slug,
        key: file.key,
        status: "planned",
        comments: file.comments.length,
        verifiedComments: file.comments.map(c => ({ id: c.id, verified: false })),
        messages: file.comments.reduce((n, c) => n + c.thread.length, 0),
        sequence: file.sequence,
        openCount: upgraded.openCount,
        attachments: attachments.map(a => ({
          id: a.id,
          size: a.bytes.byteLength,
          sha256: hash(a.bytes),
        })),
        rewrites: upgraded.rewrites,
      };
      report.keys.push(record);
      try {
        if (seen.has(file.key)) throw new ProtoError("migration_conflict");
        seen.add(file.key);
        record.status = targetReady
          ? await storage.importKey(file, attachments, options.dryRun)
          : "planned";
        if (!options.dryRun) {
          const actual = await storage.readKey(file.key);
          if (!isDeepStrictEqual(actual, file)) throw new ProtoError("migration_unverified");
          for (const image of attachments)
            if (
              hash((await storage.store.readAttachment(file.key, image.id)).bytes) !==
              hash(image.bytes)
            )
              throw new ProtoError("migration_unverified");
          for (const comment of record.verifiedComments) comment.verified = true;
        }
      } catch (error) {
        const code = error instanceof ProtoError ? error.code : "migration_unverified";
        record.status = code === "migration_conflict" ? "conflict" : "failed";
        report.errors.push({ code, key: file.key });
      }
      if (
        JSON.stringify(sourceFingerprint(await readSource(source))) !==
        JSON.stringify(report.fingerprint)
      )
        throw new ProtoError("migration_source_changed");
    }
    report.sourceUnchanged =
      JSON.stringify(sourceFingerprint(await readSource(source))) ===
      JSON.stringify(report.fingerprint);
    if (!report.sourceUnchanged) throw new ProtoError("migration_source_changed");
    const successful = report.keys.filter(k =>
      ["copied", "unchanged", "planned"].includes(k.status)
    );
    const totals = {
      prototype_reviews: successful.length,
      prototype_comments: successful.reduce((n, k) => n + k.comments, 0),
      prototype_messages: successful.reduce((n, k) => n + k.messages, 0),
      prototype_attachments: successful.reduce((n, k) => n + k.attachments.length, 0),
      prototype_credentials: 0,
    };
    for (const table of tables)
      report.counts[table] = {
        source: snapshot[table].length,
        target: totals[table],
        status:
          table === "prototype_credentials"
            ? "not copied"
            : totals[table] === snapshot[table].length
              ? options.dryRun
                ? "planned"
                : "verified"
              : "mismatch",
      };
    if (
      tables.some(
        table => table !== "prototype_credentials" && report.counts[table]!.status === "mismatch"
      )
    )
      report.errors.push({ code: "migration_unverified" });
    report.verified = !options.dryRun && !report.errors.length;
  } catch (error) {
    report.errors.push({ code: error instanceof ProtoError ? error.code : "migration_unverified" });
  } finally {
    await source?.end({ timeout: 5 });
    await target?.end({ timeout: 5 });
  }
  if (report.fingerprint && !Object.keys(report.counts).length) {
    const copied = report.keys.filter(key => key.status === "copied" || key.status === "unchanged");
    const totals = {
      prototype_reviews: copied.length,
      prototype_comments: copied.reduce((n, k) => n + k.comments, 0),
      prototype_messages: copied.reduce((n, k) => n + k.messages, 0),
      prototype_attachments: copied.reduce((n, k) => n + k.attachments.length, 0),
      prototype_credentials: 0,
    };
    for (const table of tables)
      report.counts[table] = {
        source: report.fingerprint[table]!.count,
        target: totals[table],
        status: table === "prototype_credentials" ? "not copied" : "incomplete",
      };
  }
  const directory = resolve(options.directory ?? process.cwd());
  await mkdir(directory, { recursive: true });
  await atomicWrite(join(directory, "proto-migration-report.json"), report);
  return report;
}
