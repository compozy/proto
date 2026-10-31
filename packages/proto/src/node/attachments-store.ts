import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { inspectImage } from "./image.ts";
import type { CommentAttachment, ReviewComment } from "../shell/comments/model.ts";

const extensions: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};
const lifetime = 24 * 60 * 60 * 1000;
const validId = (id: string) => /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id);
type Pending = CommentAttachment & { createdAt: number };

export class AttachmentError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 | 413 | 415
  ) {
    super(message);
  }
}

/** Each instance owns one slug directory; callers validate the slug through discovery first. */
export class AttachmentStore {
  readonly directory: string;
  readonly pending: string;
  constructor(
    commentDirectory: string,
    private readonly commentsRoot?: string
  ) {
    this.directory = join(commentDirectory, "attachments");
    this.pending = join(this.directory, "pending");
  }
  private path(image: CommentAttachment, pending = false) {
    if (!validId(image.id) || !extensions[image.type])
      throw new AttachmentError("invalid_input", 400);
    return join(pending ? this.pending : this.directory, `${image.id}.${extensions[image.type]}`);
  }
  private metadata(id: string): Pending {
    if (!validId(id)) throw new AttachmentError("not_found", 404);
    const file = join(this.pending, `${id}.json`);
    if (!existsSync(file)) throw new AttachmentError("not_found", 404);
    return JSON.parse(readFileSync(file, "utf8")) as Pending;
  }
  upload(name: string, bytes: Uint8Array): CommentAttachment {
    let info: ReturnType<typeof inspectImage>;
    try {
      info = inspectImage(bytes);
    } catch (error) {
      throw new AttachmentError(
        error instanceof Error ? error.message : "unsupported_media_type",
        bytes.length > 5 * 1024 * 1024 ? 413 : 415
      );
    }
    mkdirSync(this.pending, { recursive: true });
    if (this.commentsRoot && existsSync(this.commentsRoot)) {
      for (const entry of readdirSync(this.commentsRoot, { withFileTypes: true })) {
        if (entry.isDirectory()) new AttachmentStore(join(this.commentsRoot, entry.name)).expire();
      }
    } else this.expire();
    const image = { id: crypto.randomUUID(), name: name.slice(0, 200), ...info };
    writeFileSync(this.path(image, true), bytes, { flag: "wx" });
    try {
      writeFileSync(
        join(this.pending, `${image.id}.json`),
        JSON.stringify({ ...image, createdAt: Date.now() }),
        { flag: "wx" }
      );
    } catch (error) {
      rmSync(this.path(image, true), { force: true });
      throw error;
    }
    return image;
  }
  private expire() {
    if (!existsSync(this.pending)) return;
    for (const file of readdirSync(this.pending).filter(file => file.endsWith(".json"))) {
      const image = this.metadata(file.slice(0, -5));
      if (image.createdAt < Date.now() - lifetime) this.discard(image.id);
    }
  }
  discard(id: string) {
    const image = this.metadata(id);
    rmSync(this.path(image, true), { force: true });
    rmSync(join(this.pending, `${id}.json`), { force: true });
  }
  read(id: string, comments: ReviewComment[]) {
    const attached = comments
      .flatMap(comment => comment.thread)
      .flatMap(message => message.attachments)
      .find(image => image.id === id);
    const image = attached ?? this.metadata(id);
    if (!attached && (image as Pending).createdAt < Date.now() - lifetime)
      throw new AttachmentError("not_found", 404);
    const path = this.path(image, !attached);
    if (!existsSync(path)) throw new AttachmentError("not_found", 404);
    return { image, bytes: readFileSync(path) };
  }
  /** Prevalidate all files, move with rollback, then publish the JSON as the commit point. */
  commit(
    current: CommentAttachment[],
    add: string[],
    remove: string[],
    persist: (images: CommentAttachment[]) => void
  ) {
    if (new Set(add).size !== add.length || new Set(remove).size !== remove.length)
      throw new AttachmentError("invalid_input", 400);
    const currentIds = new Set(current.map(image => image.id));
    const removedIds = new Set(remove);
    if (remove.some(id => !currentIds.has(id))) throw new AttachmentError("invalid_input", 400);
    const kept = current.filter(image => !removedIds.has(image.id));
    if (kept.length + add.length > 6) throw new AttachmentError("attachment_limit", 409);
    const pending = add.map(id => {
      let image: Pending;
      try {
        image = this.metadata(id);
      } catch {
        throw new AttachmentError("invalid_input", 400);
      }
      if (
        image.createdAt < Date.now() - lifetime ||
        !existsSync(this.path(image, true)) ||
        existsSync(this.path(image))
      )
        throw new AttachmentError("invalid_input", 400);
      return image;
    });
    const moved: Pending[] = [];
    try {
      for (const image of pending) {
        renameSync(this.path(image, true), this.path(image));
        moved.push(image);
      }
      persist([...kept, ...pending.map(({ createdAt: _createdAt, ...image }) => image)]);
    } catch (error) {
      for (const image of moved.reverse()) renameSync(this.path(image), this.path(image, true));
      throw error;
    }
    for (const image of pending) rmSync(join(this.pending, `${image.id}.json`), { force: true });
    for (const image of current.filter(image => removedIds.has(image.id)))
      rmSync(this.path(image), { force: true });
  }
  remove(images: CommentAttachment[]) {
    for (const image of images) rmSync(this.path(image), { force: true });
  }
}
