import { mapConcurrent } from "../node/concurrency.ts";
import { isDeepStrictEqual } from "node:util";
import { AsyncLocalStorage } from "node:async_hooks";
import { readFile } from "node:fs/promises";
import type { Sql, TransactionSql } from "postgres";
import { z } from "zod";
import { ReviewEngine } from "../store/engine.ts";
import { ProtoError } from "../model/errors.ts";
import { sourceRoots } from "../model/source.ts";
import { inspectImage } from "../node/image.ts";
import {
  commentFilterSchema,
  emptyReviewFile,
  keySchema,
  owns,
  reviewFileSchema,
  authorSchema,
  type Author,
  type ReviewFileV3,
  type PendingAttachment,
  type CommentAttachment,
} from "../model/review.ts";
import type { AttachmentInput, CommentFilter, ReviewStore } from "../store/types.ts";
import type { Registry } from "../model/registry.ts";
import type { Credential, ReviewStorage } from "./storage.ts";
const version = 1;
// Cast through text so a shared Drizzle client cannot bypass JSON serialization.
type Row = Record<string, any>; // SQL rows are validated at the model boundary below.
const iso = (value: Date | string | null) =>
  value === null ? null : new Date(value).toISOString();
const extra = (value: unknown) => (value == null ? {} : { extra: value });
const optionalAuthor = (row: Row) => ({
  ...(row.author_id ? { authorId: row.author_id } : {}),
  ...(row.author_name ? { authorName: row.author_name } : {}),
});
const ownerId = (author: Author) => author.id ?? `local:${author.kind}`;
function groupRows(rows: readonly Row[], key: (row: Row) => string) {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const id = key(row);
    const group = groups.get(id);
    if (group) group.push(row);
    else groups.set(id, [row]);
  }
  return groups;
}
function image(row: Row): CommentAttachment {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    size: row.size,
    width: row.width,
    height: row.height,
    uploaderId: row.uploader_id.startsWith("local:") ? undefined : row.uploader_id,
    uploaderKind: row.uploader_kind,
    ...extra(row.extra),
  } as CommentAttachment;
}
class PostgresStore extends ReviewEngine implements ReviewStore {
  readonly sql: Sql;
  readonly transaction = new AsyncLocalStorage<TransactionSql>();
  registry?: () => Promise<Registry>;
  revision: () => Promise<string | null> = async () => null;
  constructor(sql: Sql) {
    super();
    this.sql = sql;
  }
  protected async roots() {
    return (await this.registry?.())?.sourceRoots ?? sourceRoots();
  }
  protected commit() {
    return this.revision();
  }
  async assertKey(key: string) {
    keySchema.parse(key);
    if (!this.registry) return;
    const registry = await this.registry();
    if (
      !registry.prototypes.some(p => p.slug === key) &&
      !registry.flows.some(f => `flow-${f.id}` === key)
    )
      throw new ProtoError("comment_not_found");
  }
  private connection() {
    return this.transaction.getStore() ?? this.sql;
  }
  async readFile(key: string): Promise<ReviewFileV3> {
    keySchema.parse(key);
    return (await this.readFiles([key]))[0] ?? emptyReviewFile(key);
  }
  private async readFiles(keys?: readonly string[]): Promise<ReviewFileV3[]> {
    if (keys?.length === 0) return [];
    for (const key of keys ?? []) keySchema.parse(key);
    if (!this.transaction.getStore())
      return (await this.sql.begin("isolation level repeatable read read only", sql =>
        this.transaction.run(sql, () => this.readFiles(keys))
      )) as ReviewFileV3[];
    const sql = this.connection();
    const rows = keys
      ? await sql`select * from proto_keys where key in ${sql(keys)} order by key`
      : await sql`select * from proto_keys order by key`;
    if (!rows.length) return [];
    const selected = rows.map(row => String(row.key));
    // These relation reads share the same repeatable-read transaction and have no data dependency.
    const [comments, messages, images, events] = await Promise.all([
      sql`select * from proto_comments where key in ${sql(selected)} order by key,number`,
      sql`select * from proto_messages where key in ${sql(selected)} order by key,number,position`,
      // List/review reads need descriptors, never the potentially megabyte-sized image bodies.
      sql`select id,key,message_id,uploader_id,uploader_kind,name,type,size,width,height,extra from proto_attachments where key in ${sql(selected)} and message_id is not null order by key,position,id`,
      sql`select * from proto_events where key in ${sql(selected)} order by key,position,id`,
    ]);
    const commentsByKey = groupRows(comments, row => row.key);
    const messagesByComment = groupRows(messages, row => `${row.key}:${row.number}`);
    const imagesByMessage = groupRows(images, row => row.message_id);
    const eventsByKey = groupRows(events, row => row.key);
    return rows.map(row =>
      reviewFileSchema.parse({
        version: 3,
        key: row.key,
        sequence: row.next_comment - 1,
        review: { status: row.review_status, updatedAt: iso(row.review_updated_at) },
        ...extra(row.extra),
        events: (eventsByKey.get(row.key) ?? []).map(e => ({
          id: e.id,
          type: e.type,
          at: iso(e.at),
          author: e.author_kind,
          ...optionalAuthor(e),
          commit: e.commit,
          openCount: e.open_count,
          ...(e.comment_id ? { commentId: e.comment_id } : {}),
          ...extra(e.extra),
        })),
        comments: (commentsByKey.get(row.key) ?? []).map(c => ({
          id: `${row.key}-${c.number}`,
          slug: row.key,
          status: c.status,
          createdAt: iso(c.created_at),
          updatedAt: iso(c.updated_at),
          resolvedAt: iso(c.resolved_at),
          context: c.context,
          target: c.target,
          ...extra(c.extra),
          thread: (messagesByComment.get(`${row.key}:${c.number}`) ?? []).map(m => ({
            id: m.id,
            at: iso(m.at),
            editedAt: iso(m.edited_at),
            body: m.body,
            author: m.author_kind,
            ...optionalAuthor(m),
            ...extra(m.extra),
            attachments: (imagesByMessage.get(m.id) ?? []).map(image),
          })),
        })),
      })
    );
  }
  private async locked<T>(key: string, action: (sql: TransactionSql) => Promise<T>): Promise<T> {
    keySchema.parse(key);
    return (await this.sql.begin(async sql => {
      await sql`insert into proto_keys (key) values (${key}) on conflict do nothing`;
      await sql`select key from proto_keys where key=${key} for update`;
      await sql`delete from proto_attachments where key=${key} and message_id is null and expires_at <= now()`;
      return this.transaction.run(sql, () => action(sql));
    })) as T;
  }
  protected async mutate<T>(key: string, action: (file: ReviewFileV3) => Promise<T>): Promise<T> {
    return this.locked(key, async sql => {
      const file = await this.readFile(key);
      const result = await action(file);
      await this.save(sql, file);
      return result;
    });
  }
  private async save(sql: TransactionSql, file: ReviewFileV3) {
    const key = file.key;
    reviewFileSchema.parse(file);
    await sql`update proto_keys set next_comment=${file.sequence + 1}, review_status=${file.review.status}, review_updated_at=${file.review.updatedAt}, extra=${JSON.stringify(file.extra ?? null)}::text::jsonb where key=${key}`;
    const comments = file.comments.map(comment => ({
      key,
      number: Number(comment.id.slice(key.length + 1)),
      status: comment.status,
      created_at: comment.createdAt,
      updated_at: comment.updatedAt,
      resolved_at: comment.resolvedAt,
      context: comment.context,
      target: comment.target,
      extra: comment.extra ?? null,
    }));
    const messages = file.comments.flatMap(comment =>
      comment.thread.map((message, position) => ({
        id: message.id,
        key,
        number: Number(comment.id.slice(key.length + 1)),
        position,
        author_kind: message.author,
        author_id: message.authorId ?? null,
        author_name: message.authorName ?? null,
        body: message.body,
        at: message.at,
        edited_at: message.editedAt,
        extra: message.extra ?? null,
      }))
    );
    const images = file.comments.flatMap(comment =>
      comment.thread.flatMap(message =>
        message.attachments.map((attachment, position) => ({
          id: attachment.id,
          message_id: message.id,
          position,
        }))
      )
    );
    // One statement per relation, in foreign-key order, independent of thread/history length.
    await sql`insert into proto_comments select * from jsonb_populate_recordset(null::proto_comments, ${JSON.stringify(comments)}::text::jsonb) on conflict (key,number) do update set status=excluded.status,updated_at=excluded.updated_at,resolved_at=excluded.resolved_at,context=excluded.context,target=excluded.target,extra=excluded.extra`;
    await sql`insert into proto_messages select * from jsonb_populate_recordset(null::proto_messages, ${JSON.stringify(messages)}::text::jsonb) on conflict (id) do update set body=excluded.body,edited_at=excluded.edited_at,extra=excluded.extra`;
    const updated =
      await sql`update proto_attachments a set message_id=i.message_id,expires_at=null,position=i.position from jsonb_to_recordset(${JSON.stringify(images)}::text::jsonb) as i(id text,message_id text,position integer) where a.id=i.id and a.key=${key} and (a.message_id=i.message_id or a.message_id is null) returning a.id`;
    if (updated.length !== images.length) throw new ProtoError("attachment_expired");
    await sql`delete from proto_attachments where key=${key} and message_id is not null and not (id=any(${images.map(image => image.id)}))`;
    await sql`delete from proto_messages where key=${key} and not (id=any(${messages.map(message => message.id)}))`;
    await sql`delete from proto_comments where key=${key} and not (number=any(${comments.map(comment => comment.number)}))`;
    const events = file.events.map((event, position) => ({
      id: event.id,
      key,
      position,
      type: event.type,
      at: event.at,
      author_kind: event.author,
      author_id: event.authorId ?? null,
      author_name: event.authorName ?? null,
      commit: event.commit,
      open_count: event.openCount,
      comment_id: event.commentId ?? null,
      extra: event.extra ?? null,
    }));
    await sql`insert into proto_events select * from jsonb_populate_recordset(null::proto_events, ${JSON.stringify(events)}::text::jsonb) on conflict do nothing`;
  }

  async importKey(
    file: ReviewFileV3,
    attachments: ImportedAttachment[],
    dryRun = false
  ): Promise<"copied" | "unchanged" | "planned"> {
    file = reviewFileSchema.parse(file);
    const outcome = await this.sql
      .begin(async sql =>
        this.transaction.run(sql, async () => {
          const inserted =
            await sql`insert into proto_keys(key) values (${file.key}) on conflict do nothing returning key`;
          await sql`select key from proto_keys where key=${file.key} for update`;
          if (!inserted.length) {
            if (!isDeepStrictEqual(await this.readFile(file.key), file))
              throw new ProtoError("migration_conflict");
            await mapConcurrent(attachments, async attachment => {
              const [row] =
                await sql`select data from proto_attachments where key=${file.key} and id=${attachment.id}`;
              if (!row || !Buffer.from(row.data).equals(Buffer.from(attachment.bytes)))
                throw new ProtoError("migration_conflict");
            });
            return "unchanged" as const;
          }
          if (dryRun) throw new PlannedImport();
          const payloads = new Map(attachments.map(value => [value.id, value]));
          const imported = file.comments.flatMap(c =>
            c.thread.flatMap(m => m.attachments.map(a => ({ a, m })))
          );
          await mapConcurrent(imported, async ({ a, m }) => {
            const payload = payloads.get(a.id);
            if (!payload || payload.bytes.byteLength !== a.size)
              throw new ProtoError("migration_unverified");
            await sql`insert into proto_attachments(id,key,uploader_id,uploader_kind,name,type,size,width,height,data,created_at,expires_at,extra) values (${a.id},${file.key},${a.uploaderId ?? "legacy:unknown"},${a.uploaderKind ?? m.author},${a.name},${a.type},${a.size},${a.width},${a.height},${Buffer.from(payload.bytes)},${payload.createdAt},null,${JSON.stringify(a.extra ?? null)}::text::jsonb)`;
          });
          await this.save(sql, file);
          if (!isDeepStrictEqual(await this.readFile(file.key), file))
            throw new ProtoError("migration_unverified");
          return "copied" as const;
        })
      )
      .catch(error => {
        if (error instanceof PlannedImport) return "planned" as const;
        throw error;
      });
    return outcome;
  }
  protected async claim(
    key: string,
    file: ReviewFileV3,
    ids: string[],
    author: Author,
    messageId: string
  ): Promise<CommentAttachment[]> {
    if (ids.length > 6) throw new ProtoError("attachment_limit");
    const sql = this.transaction.getStore();
    if (!sql) throw new Error("Claim requires a transaction");
    const claimed = new Set(
      file.comments.flatMap(c => c.thread.flatMap(m => m.attachments.map(a => a.id)))
    );
    for (const id of ids) {
      z.uuid().parse(id);
      if (claimed.has(id)) throw new ProtoError("attachment_expired");
      claimed.add(id);
    }
    if (!ids.length) return [];
    const rows =
      await sql`select * from proto_attachments where id=any(${ids}) and key=${key} and message_id is null and expires_at > now()`;
    if (rows.length !== ids.length) throw new ProtoError("attachment_expired");
    if (rows.some(row => row.uploader_id !== ownerId(author)))
      throw new ProtoError("message_not_owned");
    // The key lock and deferred FK make the entire conditional claim atomic before message insertion.
    const updated =
      await sql`update proto_attachments set message_id=${messageId} where id=any(${ids}) and key=${key} and uploader_id=${ownerId(author)} and message_id is null and expires_at > now() returning *`;
    if (updated.length !== ids.length) throw new ProtoError("attachment_expired");
    const byId = new Map(updated.map(row => [row.id, image(row)]));
    return ids.map(id => byId.get(id)!);
  }

  async list(filter: CommentFilter = {}) {
    filter = commentFilterSchema.parse(filter);
    const registry = filter.spec ? await this.registry?.() : undefined;
    const specKeys = new Set([
      ...(registry?.prototypes.filter(p => p.spec === filter.spec).map(p => p.slug) ?? []),
      ...(registry?.flows.filter(p => p.spec === filter.spec).map(p => `flow-${p.id}`) ?? []),
    ]);
    const keys = filter.key
      ? !filter.spec || specKeys.has(filter.key)
        ? [filter.key]
        : []
      : filter.spec
        ? [...specKeys]
        : undefined;
    const files = await this.readFiles(keys);
    return files
      .flatMap(f => f.comments)
      .filter(
        c =>
          ((filter.status ?? "open") === "all" || c.status === (filter.status ?? "open")) &&
          (filter.state === undefined || c.context.state === filter.state) &&
          (!filter.authorKind || c.thread[0]?.author === filter.authorKind) &&
          (filter.waiting === undefined || (c.thread.at(-1)?.author === "agent") === filter.waiting)
      );
  }
  async upload(key: string, file: AttachmentInput, author: Author): Promise<PendingAttachment> {
    await this.assertKey(key);
    authorSchema.parse(author);
    if (file.bytes.length > 5 * 1024 * 1024) throw new ProtoError("attachment_too_large");
    let info: ReturnType<typeof inspectImage>;
    try {
      info = inspectImage(file.bytes);
    } catch {
      throw new ProtoError("attachment_type");
    }
    if (file.type && file.type !== info.type) throw new ProtoError("attachment_type");
    return this.locked(key, async sql => {
      const value: PendingAttachment = {
        id: crypto.randomUUID(),
        name: file.name.slice(0, 200),
        ...info,
        uploaderKind: author.kind,
        ...(author.id ? { uploaderId: author.id } : {}),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };
      await sql`insert into proto_attachments (id,key,uploader_id,uploader_kind,name,type,size,width,height,data,created_at,expires_at) values (${value.id},${key},${ownerId(author)},${author.kind},${value.name},${value.type},${value.size},${value.width},${value.height},${Buffer.from(file.bytes)},now(),${value.expiresAt})`;
      return value;
    });
  }
  async discard(key: string, id: string, author: Author) {
    authorSchema.parse(author);
    await this.locked(key, async sql => {
      const [row] =
        await sql`select * from proto_attachments where id=${id} and key=${key} and message_id is null`;
      if (!row) throw new ProtoError("attachment_expired");
      if (
        !owns(
          author,
          row.uploader_kind,
          row.uploader_id.startsWith("local:") ? undefined : row.uploader_id
        )
      )
        throw new ProtoError("message_not_owned");
      await sql`delete from proto_attachments where id=${id}`;
    });
  }
  async readAttachment(key: string, id: string) {
    const [row] = await this
      .sql`select data,type,name from proto_attachments where id=${id} and key=${key} and (message_id is not null or expires_at > now())`;
    if (!row) throw new ProtoError("attachment_expired");
    return { bytes: new Uint8Array(row.data), type: row.type as string, name: row.name as string };
  }
  async unlock(_key: string, _options: { force: true }): Promise<never> {
    throw new ProtoError("scope_denied", "Unlock is local only.");
  }
}
function credential(row: Row): Credential {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    scopes: ["comment"],
    hash: Buffer.from(row.hash).toString("hex"),
    createdAt: iso(row.created_at)!,
    lastUsedAt: iso(row.last_used_at),
    revokedAt: iso(row.revoked_at),
  };
}
export type ImportedAttachment = { id: string; bytes: Uint8Array; createdAt: string };
class PlannedImport extends Error {}
export type PostgresReviewStorage = ReviewStorage & {
  migrate(): Promise<void>;
  readKey(key: string): Promise<ReviewFileV3>;
  importKey(
    file: ReviewFileV3,
    attachments: ImportedAttachment[],
    dryRun?: boolean
  ): Promise<"copied" | "unchanged" | "planned">;
};
export function postgresStorage(sql: Sql): PostgresReviewStorage {
  const store = new PostgresStore(sql);
  return {
    store,
    readKey: key => store.readFile(key),
    importKey: (file, attachments, dryRun) => store.importKey(file, attachments, dryRun),
    configure(registry, commit) {
      store.registry = registry;
      store.revision = commit;
    },
    async checkSchema() {
      try {
        const rows = await sql`select version from proto_schema`;
        if (rows.length !== 1 || rows[0]!.version !== version)
          throw new ProtoError("schema_mismatch");
      } catch (error) {
        if (error instanceof ProtoError || (error as { code?: string }).code === "42P01")
          throw new ProtoError("schema_mismatch");
        throw error;
      }
    },
    async migrate() {
      const connection = await sql.reserve();
      try {
        await connection`select pg_advisory_lock(707261, 1)`;
        await connection.unsafe("BEGIN");
        try {
          const [exists] = await connection`select to_regclass('proto_schema') as name`;
          if (exists?.name) {
            const versions = await connection`select version from proto_schema`;
            if (versions.length !== 1 || versions[0]!.version !== version)
              throw new ProtoError("schema_mismatch");
          } else
            await connection.unsafe(
              await readFile(new URL("./migrations/0001_review.sql", import.meta.url), "utf8")
            );
          await connection.unsafe("COMMIT");
        } catch (error) {
          await connection.unsafe("ROLLBACK");
          throw error;
        }
      } finally {
        try {
          await connection`select pg_advisory_unlock(707261, 1)`;
        } finally {
          connection.release();
        }
      }
    },
    credentials: {
      async create(c) {
        await sql`insert into proto_credentials (id,owner_id,name,scopes,hash,created_at) values (${c.id},${c.ownerId},${c.name},${c.scopes},${Buffer.from(c.hash, "hex")},${c.createdAt})`;
      },
      async find(hash) {
        const [row] =
          await sql`select * from proto_credentials where hash=${Buffer.from(hash, "hex")}`;
        return row ? credential(row) : null;
      },
      async list(ownerId) {
        return (
          await sql`select * from proto_credentials where owner_id=${ownerId} order by created_at`
        ).map(credential);
      },
      async revoke(ownerId, id) {
        await sql`update proto_credentials set revoked_at=now() where id=${id} and owner_id=${ownerId}`;
      },
      async used(id) {
        await sql`update proto_credentials set last_used_at=now() where id=${id}`;
      },
    },
  };
}
