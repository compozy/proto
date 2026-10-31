/**
 * The review backend of the comment-mode browser suite: the real review router
 * (`src/review/router.ts`, runtime-agnostic, so it validates bodies and confines sources exactly
 * as in `proto dev`) over an in-memory store, answering the shell's `fetch` to `/__proto/api/`.
 * Only the storage is in memory — the I/O boundary; the file store has its own suites.
 */
import { ProtoError } from "../../../src/model/errors.ts";
import type {
  Author,
  NewComment,
  PendingAttachment,
  ReviewComment,
} from "../../../src/model/review.ts";
import { createReviewRouter } from "../../../src/review/router.ts";
import type { ReviewStore } from "../../../src/store/types.ts";
import { registry } from "./comment-fixtures.ts";

export type Backend = {
  comments: ReviewComment[];
  pending: Map<string, PendingAttachment & { key: string }>;
  /** Every write the router answered (method, path, status). */
  writes: { method: string; path: string; status: number }[];
  seed(comment: ReviewComment): void;
  restore(): void;
};

const unsupported = () => {
  throw new ProtoError("comment_not_found");
};

export function installBackend(): Backend {
  const comments: ReviewComment[] = [];
  const pending = new Map<string, PendingAttachment & { key: string }>();
  const writes: Backend["writes"] = [];
  const sequences = new Map<string, number>();
  const now = () => new Date().toISOString();

  const store: ReviewStore = {
    async list(filter = {}) {
      return comments.filter(
        item =>
          (!filter.key || item.slug === filter.key) &&
          (filter.status === "all" || item.status === (filter.status ?? "open"))
      );
    },
    async get(id) {
      const found = comments.find(item => item.id === id);
      if (!found) throw new ProtoError("comment_not_found");
      return found;
    },
    async add(key: string, input: NewComment, author: Author) {
      const number = (sequences.get(key) ?? 0) + 1;
      sequences.set(key, number);
      const attachments = (input.attachments ?? []).map(id => {
        const image = pending.get(id);
        if (!image) throw new ProtoError("attachment_expired");
        pending.delete(id);
        const { key: _key, expiresAt: _expires, ...stored } = image;
        return stored;
      });
      const at = now();
      const comment: ReviewComment = {
        id: `${key}-${number}`,
        slug: key,
        status: "open",
        createdAt: at,
        updatedAt: at,
        resolvedAt: null,
        context: { ...input.context, commit: null },
        target: input.target,
        thread: [
          {
            id: crypto.randomUUID(),
            at,
            editedAt: null,
            body: input.body,
            author: author.kind,
            attachments,
          },
        ],
      };
      comments.push(comment);
      return comment;
    },
    async upload(key, file, author) {
      if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type ?? ""))
        throw new ProtoError("attachment_type");
      if (file.bytes.length > 5 * 1024 * 1024) throw new ProtoError("attachment_too_large");
      const image = {
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type ?? "image/png",
        size: file.bytes.length,
        width: 1,
        height: 1,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        uploaderKind: author.kind,
        key,
      };
      pending.set(image.id, image);
      return image;
    },
    async discard(_key, id) {
      pending.delete(id);
    },
    reply: unsupported,
    setStatus: unsupported,
    editMessage: unsupported,
    remove: unsupported,
    readAttachment: unsupported,
    review: unsupported,
    transition: unsupported,
    unlock: unsupported,
  };

  const router = createReviewRouter({
    store,
    registry: () => registry,
    authorize: async () => ({ author: { kind: "reviewer" } }),
  });

  const original = window.fetch;
  window.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/__proto/api/"))
      return original(input, init);
    const response = await router(new Request(url, init));
    if (init?.method && init.method !== "GET")
      writes.push({ method: init.method, path: url.pathname, status: response.status });
    return response;
  };

  return {
    comments,
    pending,
    writes,
    seed(comment) {
      comments.push(comment);
      const number = Number(comment.id.split("-").at(-1));
      sequences.set(comment.slug, Math.max(sequences.get(comment.slug) ?? 0, number));
    },
    restore() {
      window.fetch = original;
    },
  };
}
