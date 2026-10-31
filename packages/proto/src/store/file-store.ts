import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import { ProtoError } from "../model/errors.ts";
import { upgradeReviewFile } from "../model/upgrade.ts";
import {
  authorSchema,
  commentFilterSchema,
  commitSchema,
  emptyReviewFile,
  keySchema,
  messageChangeSchema,
  newCommentSchema,
  newMessageSchema,
  owns,
  pendingAttachmentSchema,
  reviewFileSchema,
  type Author,
  type CommentAttachment,
  type CommentMessage,
  type ReviewFileV3,
  type ReviewComment,
  type ReviewState,
} from "../model/review.ts";
import { confineSource, sourceRoots, type SourceRoots } from "../model/source.ts";
import { inspectImage } from "../node/image.ts";
import { KeyLocks, type LockEnvironment } from "./lock.ts";
import type {
  AttachmentInput,
  CommentFilter,
  MessageChange,
  NewComment,
  NewMessage,
  PendingAttachment,
  ReviewStore,
} from "./types.ts";
const exec = promisify(execFile);
const extensions: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
const absent = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";
const lifetime = 86400000;
export type FileStoreOptions = {
  /** App root. The default storage directory is <root>/proto/review. */
  root: string;
  directory?: string;
  registry?: () => Promise<{
    prototypes: { slug: string; spec: string | null }[];
    flows: { id: string; spec: string | null }[];
  }>;
  roots?: SourceRoots;
  clock?: () => Date;
  lockEnvironment?: LockEnvironment;
};
export async function currentCommit(root: string): Promise<string | null> {
  try {
    const value = (await exec("git", ["rev-parse", "HEAD"], { cwd: root })).stdout.trim();
    if (commitSchema.safeParse(value).success) return value;
  } catch {
    /* Exports may have REVISION instead of .git. */
  }
  const revision = process.env.REVISION;
  return revision && /^[a-f0-9]{40}$/.test(revision) ? revision : null;
}
export async function atomicWrite(path: string, value: unknown) {
  const temporary = `${path}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}
export class FileStore implements ReviewStore {
  readonly directory: string;
  readonly locks: KeyLocks;
  private opening?: Promise<void>;
  readonly options: FileStoreOptions;
  constructor(options: FileStoreOptions) {
    this.options = options;
    this.directory = resolve(options.directory ?? join(options.root, "proto/review"));
    this.locks = new KeyLocks(this.directory, options.lockEnvironment);
  }
  private now() {
    return (this.options.clock?.() ?? new Date()).toISOString();
  }
  async ready() {
    this.opening ??= this.initialize();
    await this.opening;
  }
  private async initialize() {
    await mkdir(this.directory, { recursive: true });
    try {
      await writeFile(join(this.directory, ".gitignore"), "*.lock*\n*.tmp\n.pending/\n", {
        flag: "wx",
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    const pendingRoot = join(this.directory, ".pending");
    let keys: string[];
    try {
      keys = await readdir(pendingRoot);
    } catch (error) {
      if (absent(error)) return;
      throw error;
    }
    for (const key of keys.filter(key => keySchema.safeParse(key).success))
      await this.locks.run(key, async () => {
        for (const name of await readdir(join(pendingRoot, key))) {
          if (!name.endsWith(".json")) continue;
          const id = name.slice(0, -5);
          if (!z.uuid().safeParse(id).success) continue;
          const pending = await this.pending(key, id);
          if (pending && Date.parse(pending.expiresAt) <= Date.parse(this.now()))
            await this.deletePending(key, pending);
        }
      });
  }
  async assertKey(key: string) {
    keySchema.parse(key);
    if (this.options.registry) {
      const registry = await this.options.registry();
      if (
        !registry.prototypes.some(item => item.slug === key) &&
        !registry.flows.some(item => `flow-${item.id}` === key)
      )
        throw new ProtoError("comment_not_found", `Unknown review key "${key}".`);
    }
  }
  private path(key: string) {
    return join(this.directory, `${key}.json`);
  }
  async readFile(key: string): Promise<ReviewFileV3> {
    await this.ready();
    await this.assertKey(key);
    try {
      const result = upgradeReviewFile(JSON.parse(await readFile(this.path(key), "utf8")));
      if (!result.ok || result.file.key !== key)
        throw new ProtoError("migration_unverified", "Invalid review file; no data was changed.");
      return result.file;
    } catch (error) {
      if (absent(error)) return emptyReviewFile(key);
      throw error;
    }
  }
  private async mutate<T>(key: string, action: (file: ReviewFileV3) => Promise<T>): Promise<T> {
    await this.ready();
    await this.assertKey(key);
    return this.locks.run(key, async () => {
      const file = await this.readFile(key);
      const before = JSON.stringify(file);
      const previousImages = file.comments.flatMap(comment =>
        comment.thread.flatMap(message => message.attachments)
      );
      const result = await action(file);
      if (JSON.stringify(file) !== before)
        await atomicWrite(this.path(key), reviewFileSchema.parse(file));
      const referenced = new Set(
        file.comments.flatMap(comment =>
          comment.thread.flatMap(message => message.attachments.map(image => image.id))
        )
      );
      for (const image of previousImages)
        if (!referenced.has(image.id)) await rm(this.imagePath(key, image), { force: true });
      // The v3 file is the claim commit point. Cleanup is recoverable after a crash.
      for (const image of file.comments.flatMap(comment =>
        comment.thread.flatMap(message => message.attachments)
      )) {
        const pending = await this.pending(key, image.id);
        if (pending) await this.deletePending(key, pending);
      }
      return result;
    });
  }
  async list(filter: CommentFilter = {}) {
    filter = commentFilterSchema.parse(filter);
    await this.ready();
    const keys = filter.key
      ? [filter.key]
      : (await readdir(this.directory))
          .filter(name => name.endsWith(".json") && keySchema.safeParse(name.slice(0, -5)).success)
          .map(name => name.slice(0, -5))
          .sort();
    let specs: Set<string> | undefined;
    if (filter.spec) {
      const registry = await this.options.registry?.();
      specs = new Set([
        ...(registry?.prototypes.filter(item => item.spec === filter.spec).map(item => item.slug) ??
          []),
        ...(registry?.flows
          .filter(item => item.spec === filter.spec)
          .map(item => `flow-${item.id}`) ?? []),
      ]);
    }
    const comments: ReviewComment[] = [];
    for (const key of keys) {
      if (specs && !specs.has(key)) continue;
      comments.push(...(await this.readFile(key)).comments);
    }
    return comments.filter(
      comment =>
        ((filter.status ?? "open") === "all" || comment.status === (filter.status ?? "open")) &&
        (filter.state === undefined || comment.context.state === filter.state) &&
        (!filter.authorKind || comment.thread[0]?.author === filter.authorKind) &&
        (filter.waiting === undefined ||
          (comment.thread.at(-1)?.author === "agent") === filter.waiting)
    );
  }
  keyOf(id: string) {
    const match = /^(.+)-([1-9]\d*)$/.exec(id);
    if (!match) throw new ProtoError("comment_not_found");
    return keySchema.parse(match[1]);
  }
  private comment(file: ReviewFileV3, id: string) {
    const comment = file.comments.find(item => item.id === id);
    if (!comment) throw new ProtoError("comment_not_found");
    return comment;
  }
  async get(id: string) {
    return this.comment(await this.readFile(this.keyOf(id)), id);
  }
  private async message(
    key: string,
    file: ReviewFileV3,
    input: NewMessage,
    author: Author
  ): Promise<CommentMessage> {
    input = newMessageSchema.parse(input);
    authorSchema.parse(author);
    return {
      id: crypto.randomUUID(),
      at: this.now(),
      editedAt: null,
      body: input.body,
      author: author.kind,
      ...(author.id ? { authorId: author.id } : {}),
      ...(author.name ? { authorName: author.name } : {}),
      attachments: await this.claim(key, file, input.attachments ?? [], author),
    };
  }
  async add(key: string, input: NewComment, author: Author) {
    input = newCommentSchema.parse(input);
    if (input.target.kind !== "node") {
      const roots = this.options.roots ?? sourceRoots();
      if (input.target.source !== null) confineSource(input.target.source, roots);
      for (const source of input.target.sourceChain) confineSource(source, roots);
    }
    return this.mutate(key, async file => {
      const at = this.now();
      const comment: ReviewComment = {
        id: `${key}-${file.sequence + 1}`,
        slug: key,
        status: "open",
        createdAt: at,
        updatedAt: at,
        resolvedAt: null,
        context: { ...input.context, commit: await currentCommit(this.options.root) },
        target: input.target,
        thread: [await this.message(key, file, input, author)],
      };
      file.sequence++;
      file.comments.push(comment);
      if (file.review.status === "approved") {
        file.review = { status: "in_review", updatedAt: at };
        file.events.push({
          id: crypto.randomUUID(),
          type: "auto_reopened",
          at,
          author: "system",
          commit: comment.context.commit ?? null,
          openCount: this.state(file).open,
          commentId: comment.id,
        });
      }
      return comment;
    });
  }
  async reply(id: string, input: NewMessage, author: Author) {
    return this.mutate(this.keyOf(id), async file => {
      const comment = this.comment(file, id);
      comment.thread.push(await this.message(file.key, file, input, author));
      comment.updatedAt = this.now();
      return comment;
    });
  }
  async setStatus(id: string, status: "open" | "resolved", author: Author, note?: NewMessage) {
    z.enum(["open", "resolved"]).parse(status);
    authorSchema.parse(author);
    return this.mutate(this.keyOf(id), async file => {
      const comment = this.comment(file, id);
      if (comment.status === status) return comment;
      if (note) comment.thread.push(await this.message(file.key, file, note, author));
      comment.status = status;
      comment.updatedAt = this.now();
      comment.resolvedAt = status === "resolved" ? comment.updatedAt : null;
      return comment;
    });
  }
  async editMessage(id: string, messageId: string, change: MessageChange, author: Author) {
    change = messageChangeSchema.parse(change);
    authorSchema.parse(author);
    return this.mutate(this.keyOf(id), async file => {
      const comment = this.comment(file, id),
        message = comment.thread.find(item => item.id === messageId);
      if (!message) throw new ProtoError("comment_not_found", "Message not found.");
      if (!owns(author, message.author, message.authorId))
        throw new ProtoError("message_not_owned");
      for (const detached of change.detach ?? []) {
        const image = message.attachments.find(item => item.id === detached);
        if (
          !image ||
          !owns(author, image.uploaderKind ?? message.author, image.uploaderId ?? message.authorId)
        )
          throw new ProtoError("message_not_owned");
      }
      const kept = message.attachments.filter(image => !change.detach?.includes(image.id));
      if (kept.length + (change.attach?.length ?? 0) > 6) throw new ProtoError("attachment_limit");
      const attached = await this.claim(file.key, file, change.attach ?? [], author);
      message.attachments = [...kept, ...attached];
      if (change.body !== undefined) message.body = change.body;
      message.editedAt = this.now();
      comment.updatedAt = message.editedAt;
      return comment;
    });
  }
  async remove(id: string, author: Author) {
    authorSchema.parse(author);
    await this.mutate(this.keyOf(id), async file => {
      this.comment(file, id);
      file.comments = file.comments.filter(item => item.id !== id);
    });
  }
  private imagePath(key: string, image: CommentAttachment, pending = false) {
    z.string()
      .regex(/^[a-zA-Z0-9_-]+$/)
      .max(200)
      .parse(image.id);
    const extension = extensions[image.type];
    if (!extension) throw new ProtoError("attachment_type");
    return join(
      this.directory,
      ...(pending ? [".pending", key] : [key, "attachments"]),
      `${image.id}.${extension}`
    );
  }
  private pendingPath(key: string, id: string) {
    z.uuid().parse(id);
    return join(this.directory, ".pending", key, `${id}.json`);
  }
  private async pending(key: string, id: string): Promise<PendingAttachment | null> {
    // Legacy attachments may use non-UUID ids; they cannot be pending uploads.
    if (!z.uuid().safeParse(id).success) return null;
    try {
      return pendingAttachmentSchema.parse(
        JSON.parse(await readFile(this.pendingPath(key, id), "utf8"))
      );
    } catch (error) {
      if (absent(error)) return null;
      throw error;
    }
  }
  private async deletePending(key: string, image: PendingAttachment) {
    await rm(this.pendingPath(key, image.id), { force: true });
    await rm(this.imagePath(key, image, true), { force: true });
  }
  private async claim(
    key: string,
    file: ReviewFileV3,
    ids: string[],
    author: Author
  ): Promise<CommentAttachment[]> {
    if (ids.length > 6) throw new ProtoError("attachment_limit");
    const claimed = new Set(
      file.comments.flatMap(comment =>
        comment.thread.flatMap(message => message.attachments.map(image => image.id))
      )
    );
    const images: PendingAttachment[] = [];
    for (const id of ids) {
      const image = await this.pending(key, id);
      if (!image || claimed.has(id) || Date.parse(image.expiresAt) <= Date.parse(this.now()))
        throw new ProtoError("attachment_expired");
      if (!owns(author, image.uploaderKind, image.uploaderId))
        throw new ProtoError("message_not_owned");
      images.push(image);
    }
    if (images.length) await mkdir(join(this.directory, key, "attachments"), { recursive: true });
    // Copy before publication: until the atomic JSON rename pending metadata remains authoritative.
    for (const image of images)
      await copyFile(this.imagePath(key, image, true), this.imagePath(key, image));
    return images.map(({ expiresAt: _expiresAt, ...image }) => image);
  }
  async upload(key: string, file: AttachmentInput, author: Author) {
    authorSchema.parse(author);
    await this.ready();
    await this.assertKey(key);
    if (file.bytes.length > 5 * 1024 * 1024) throw new ProtoError("attachment_too_large");
    let info: ReturnType<typeof inspectImage>;
    try {
      info = inspectImage(file.bytes);
    } catch {
      throw new ProtoError("attachment_type");
    }
    if (file.type && file.type !== info.type) throw new ProtoError("attachment_type");
    return this.locks.run(key, async () => {
      const image: PendingAttachment = {
        id: crypto.randomUUID(),
        name: file.name.slice(0, 200),
        ...info,
        uploaderKind: author.kind,
        ...(author.id ? { uploaderId: author.id } : {}),
        expiresAt: new Date(Date.parse(this.now()) + lifetime).toISOString(),
      };
      await mkdir(join(this.directory, ".pending", key), { recursive: true });
      await writeFile(this.imagePath(key, image, true), file.bytes, { flag: "wx" });
      await atomicWrite(this.pendingPath(key, image.id), image);
      return image;
    });
  }
  async discard(key: string, attachmentId: string, author: Author) {
    authorSchema.parse(author);
    await this.ready();
    await this.assertKey(key);
    await this.locks.run(key, async () => {
      const file = await this.readFile(key);
      if (
        file.comments.some(comment =>
          comment.thread.some(message =>
            message.attachments.some(image => image.id === attachmentId)
          )
        )
      )
        throw new ProtoError("attachment_expired");
      const image = await this.pending(key, attachmentId);
      if (!image) throw new ProtoError("attachment_expired");
      if (!owns(author, image.uploaderKind, image.uploaderId))
        throw new ProtoError("message_not_owned");
      await this.deletePending(key, image);
    });
  }
  async readAttachment(key: string, attachmentId: string) {
    await this.ready();
    await this.assertKey(key);
    return this.locks.run(key, async () => {
      const file = await this.readFile(key);
      const image = file.comments
        .flatMap(comment => comment.thread.flatMap(message => message.attachments))
        .find(image => image.id === attachmentId);
      const pending = image ? null : await this.pending(key, attachmentId);
      if (!image && (!pending || Date.parse(pending.expiresAt) <= Date.parse(this.now())))
        throw new ProtoError("attachment_expired");
      const found = image ?? pending!;
      return {
        bytes: new Uint8Array(await readFile(this.imagePath(key, found, !image))),
        type: found.type,
        name: found.name,
      };
    });
  }
  private state(file: ReviewFileV3): ReviewState {
    return {
      key: file.key,
      ...file.review,
      open: file.comments.filter(comment => comment.status === "open").length,
      events: file.events,
    };
  }
  async review(key: string) {
    return this.state(await this.readFile(key));
  }
  async transition(
    key: string,
    to: "approved" | "in_review",
    author: Author,
    options: { commit: string | null; confirmOpen?: boolean }
  ) {
    z.enum(["approved", "in_review"]).parse(to);
    authorSchema.parse(author);
    commitSchema.parse(options.commit);
    return this.mutate(key, async file => {
      if (file.review.status === to) return this.state(file);
      const openCount = this.state(file).open;
      if (to === "approved" && openCount && !options.confirmOpen)
        throw new ProtoError("review_has_open_comments");
      const at = this.now();
      file.review = { status: to, updatedAt: at };
      file.events.push({
        id: crypto.randomUUID(),
        type: to === "approved" ? "approved" : "reopened",
        at,
        author: author.kind,
        ...(author.id ? { authorId: author.id } : {}),
        ...(author.name ? { authorName: author.name } : {}),
        commit: options.commit,
        openCount,
      });
      return this.state(file);
    });
  }
  async unlock(key: string, options: { force: true }) {
    if (options.force !== true)
      throw new ProtoError("invalid_input", "Unlock requires force: true.");
    // Recovery must not wait for pending-upload expiry to acquire this same stuck key.
    await mkdir(this.directory, { recursive: true });
    await this.assertKey(key);
    return this.locks.unlock(key);
  }
  /** Watches only published key files; catches writes by CLI/other OS processes. */
  async subscribe(
    listener: (event: { type: "comments" | "review"; key: string }) => void
  ): Promise<() => void> {
    await this.ready();
    let stopped = false;
    let scanning = false;
    let previous = new Map<string, string>();
    const notify = (name: string) => {
      if (!name.endsWith(".json")) return;
      const key = name.slice(0, -5);
      if (!keySchema.safeParse(key).success) return;
      listener({ type: "comments", key });
      listener({ type: "review", key });
    };
    const scan = async () => {
      if (stopped || scanning) return;
      scanning = true;
      try {
        const next = new Map<string, string>();
        for (const name of await readdir(this.directory)) {
          if (!name.endsWith(".json")) continue;
          try {
            const info = await stat(join(this.directory, name));
            next.set(name, `${info.mtimeMs}:${info.size}:${info.ino}`);
          } catch (error) {
            if (!absent(error)) throw error;
          }
        }
        if (!stopped)
          for (const name of new Set([...previous.keys(), ...next.keys()]))
            if (previous.get(name) !== next.get(name)) notify(name);
        previous = next;
      } finally {
        scanning = false;
      }
    };
    // Directory notifications can be dropped on mounted worktrees; poll only published files.
    const polling = setInterval(() => {
      void scan().catch(() => {});
    }, 250);
    return () => {
      stopped = true;
      clearInterval(polling);
    };
  }
}
