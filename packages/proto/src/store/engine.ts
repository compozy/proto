import { z } from "zod";
import { ProtoError } from "../model/errors.ts";
import {
  authorSchema,
  commitSchema,
  keySchema,
  messageChangeSchema,
  newCommentSchema,
  newMessageSchema,
  owns,
  type Author,
  type CommentAttachment,
  type CommentMessage,
  type ReviewFileV3,
  type ReviewComment,
  type ReviewState,
} from "../model/review.ts";
import { confineSource, type SourceRoots } from "../model/source.ts";
import type { NewComment, NewMessage, MessageChange } from "./types.ts";
/** Shared mutations; adapters supply one atomic per-key transaction and attachment claims. */
export abstract class ReviewEngine {
  abstract readFile(key: string): Promise<ReviewFileV3>;
  protected abstract mutate<T>(key: string, action: (file: ReviewFileV3) => Promise<T>): Promise<T>;
  protected abstract claim(
    key: string,
    file: ReviewFileV3,
    ids: string[],
    author: Author,
    messageId: string
  ): Promise<CommentAttachment[]>;
  protected abstract commit(): Promise<string | null>;
  protected abstract roots(): SourceRoots;
  protected now() {
    return new Date().toISOString();
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
    const id = crypto.randomUUID();
    return {
      id,
      at: this.now(),
      editedAt: null,
      body: input.body,
      author: author.kind,
      ...(author.id ? { authorId: author.id } : {}),
      ...(author.name ? { authorName: author.name } : {}),
      attachments: await this.claim(key, file, input.attachments ?? [], author, id),
    };
  }
  async add(key: string, input: NewComment, author: Author) {
    input = newCommentSchema.parse(input);
    if (input.target.kind !== "node") {
      const roots = this.roots();
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
        context: { ...input.context, commit: await this.commit() },
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
      const attached = await this.claim(file.key, file, change.attach ?? [], author, message.id);
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
}
