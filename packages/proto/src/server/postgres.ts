import { AsyncLocalStorage } from "node:async_hooks";
import { readFile } from "node:fs/promises";
import type { Sql, TransactionSql, JSONValue } from "postgres";
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
const jsonValue = (value: unknown): JSONValue => JSON.parse(JSON.stringify(value));
type Row = Record<string, any>; // SQL rows are validated at the model boundary below.
const iso = (value: Date | string | null) =>
  value === null ? null : new Date(value).toISOString();
const extra = (value: unknown) => (value == null ? {} : { extra: value });
const optionalAuthor = (row: Row) => ({
  ...(row.author_id ? { authorId: row.author_id } : {}),
  ...(row.author_name ? { authorName: row.author_name } : {}),
});
const ownerId = (author: Author) => author.id ?? `local:${author.kind}`;
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
  protected roots() {
    return sourceRoots();
  }
  protected commit() {
    return this.revision();
  }
  private async assertKey(key: string) {
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
    await this.assertKey(key);
    if (!this.transaction.getStore())
      return (await this.sql.begin("isolation level repeatable read read only", sql =>
        this.transaction.run(sql, () => this.readFile(key))
      )) as ReviewFileV3;
    const sql = this.connection();
    const [row] = await sql`select * from proto_keys where key=${key}`;
    if (!row) return emptyReviewFile(key);
    const comments = await sql`select * from proto_comments where key=${key} order by number`;
    const messages = await sql`select * from proto_messages where key=${key} order by position`;
    const images =
      await sql`select * from proto_attachments where key=${key} and message_id is not null order by position,id`;
    const events = await sql`select * from proto_events where key=${key} order by position,id`;
    return reviewFileSchema.parse({
      version: 3,
      key,
      sequence: row.next_comment - 1,
      review: { status: row.review_status, updatedAt: iso(row.review_updated_at) },
      ...extra(row.extra),
      events: events.map(e => ({
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
      comments: comments.map(c => ({
        id: `${key}-${c.number}`,
        slug: key,
        status: c.status,
        createdAt: iso(c.created_at),
        updatedAt: iso(c.updated_at),
        resolvedAt: iso(c.resolved_at),
        context: c.context,
        target: c.target,
        ...extra(c.extra),
        thread: messages
          .filter(m => m.number === c.number)
          .map(m => ({
            id: m.id,
            at: iso(m.at),
            editedAt: iso(m.edited_at),
            body: m.body,
            author: m.author_kind,
            ...optionalAuthor(m),
            ...extra(m.extra),
            attachments: images.filter(a => a.message_id === m.id).map(image),
          })),
      })),
    });
  }
  private async locked<T>(key: string, action: (sql: TransactionSql) => Promise<T>): Promise<T> {
    await this.assertKey(key);
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
      reviewFileSchema.parse(file);
      await sql`update proto_keys set next_comment=${file.sequence + 1}, review_status=${file.review.status}, review_updated_at=${file.review.updatedAt}, extra=${sql.json(jsonValue(file.extra ?? null))} where key=${key}`;
      const numbers: number[] = [],
        messageIds: string[] = [],
        imageIds: string[] = [];
      for (const comment of file.comments) {
        const number = Number(comment.id.slice(key.length + 1));
        numbers.push(number);
        await sql`insert into proto_comments (key,number,status,created_at,updated_at,resolved_at,context,target,extra) values (${key},${number},${comment.status},${comment.createdAt},${comment.updatedAt},${comment.resolvedAt},${sql.json(jsonValue(comment.context))},${sql.json(jsonValue(comment.target))},${sql.json(jsonValue(comment.extra ?? null))}) on conflict (key,number) do update set status=excluded.status,updated_at=excluded.updated_at,resolved_at=excluded.resolved_at,context=excluded.context,target=excluded.target,extra=excluded.extra`;
        for (const [position, message] of comment.thread.entries()) {
          messageIds.push(message.id);
          await sql`insert into proto_messages (id,key,number,position,author_kind,author_id,author_name,body,at,edited_at,extra) values (${message.id},${key},${number},${position},${message.author},${message.authorId ?? null},${message.authorName ?? null},${message.body},${message.at},${message.editedAt},${sql.json(jsonValue(message.extra ?? null))}) on conflict (id) do update set body=excluded.body,edited_at=excluded.edited_at,extra=excluded.extra`;
          for (const [imagePosition, attachment] of message.attachments.entries()) {
            imageIds.push(attachment.id);
            const updated =
              await sql`update proto_attachments set message_id=${message.id},expires_at=null,position=${imagePosition} where id=${attachment.id} and key=${key} and (message_id=${message.id} or message_id is null) returning id`;
            if (updated.length !== 1) throw new ProtoError("attachment_expired");
          }
        }
      }
      await sql`delete from proto_attachments where key=${key} and message_id is not null and not (id=any(${imageIds}))`;
      await sql`delete from proto_messages where key=${key} and not (id=any(${messageIds}))`;
      await sql`delete from proto_comments where key=${key} and not (number=any(${numbers}))`;
      for (const [eventPosition, e] of file.events.entries())
        await sql`insert into proto_events (id,key,position,type,at,author_kind,author_id,author_name,commit,open_count,comment_id,extra) values (${e.id},${key},${eventPosition},${e.type},${e.at},${e.author},${e.authorId ?? null},${e.authorName ?? null},${e.commit},${e.openCount},${e.commentId ?? null},${sql.json(jsonValue(e.extra ?? null))}) on conflict do nothing`;
      return result;
    });
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
    const result: CommentAttachment[] = [];
    for (const id of ids) {
      z.uuid().parse(id);
      const [row] =
        await sql`select * from proto_attachments where id=${id} and key=${key} and message_id is null and expires_at > now()`;
      if (!row || claimed.has(id)) throw new ProtoError("attachment_expired");
      if (row.uploader_id !== ownerId(author)) throw new ProtoError("message_not_owned");
      // A deferred FK permits the conditional claim before the new message is inserted.
      const rows =
        await sql`update proto_attachments set message_id=${messageId} where id=${id} and key=${key} and uploader_id=${ownerId(author)} and message_id is null and expires_at > now() returning *`;
      if (rows.length !== 1) throw new ProtoError("attachment_expired");
      result.push(image(row));
      claimed.add(id);
    }
    return result;
  }
  async list(filter: CommentFilter = {}) {
    filter = commentFilterSchema.parse(filter);
    const keys = filter.key
      ? [{ key: filter.key }]
      : await this.sql`select key from proto_keys order by key`;
    const registry = filter.spec ? await this.registry?.() : undefined;
    const specKeys = new Set([
      ...(registry?.prototypes.filter(p => p.spec === filter.spec).map(p => p.slug) ?? []),
      ...(registry?.flows.filter(p => p.spec === filter.spec).map(p => `flow-${p.id}`) ?? []),
    ]);
    const files = await Promise.all(
      keys.filter(k => !filter.spec || specKeys.has(k.key)).map(k => this.readFile(k.key))
    );
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
export function postgresStorage(sql: Sql): ReviewStorage & { migrate(): Promise<void> } {
  const store = new PostgresStore(sql);
  return {
    store,
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
