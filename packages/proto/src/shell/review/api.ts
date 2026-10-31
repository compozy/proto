/**
 * Typed client of the review API (`_spec.md` § API Endpoints, `_dx.md` § HTTP API) for the
 * prebuilt shell: the dev router (`/__proto/api/`) and the remote server (`<basePath>api/`) share
 * one surface; read-only builds read the static review snapshots instead (`snapshotApi`).
 *
 * Writes always carry `X-Proto-Request: 1` (required on cookie-authenticated remote writes,
 * harmless on the same-origin dev router) and never send a bearer: the shell is a browser
 * session. A 401 `auth_required` calls `onAuthRequired` with the server's `signInUrl` before it
 * rejects, so the shell can show the session-expired banner (S18) and keep unsent drafts.
 * Every failure rejects with a `ReviewApiError` carrying a code of `src/model/errors.ts`.
 */
import { z } from "zod";

import { principalSchema, type BootstrapPrincipal } from "../../model/bootstrap";
import { errors, type ErrorCode } from "../../model/errors";
import {
  commentSchema,
  eventSchema,
  pendingAttachmentSchema,
  type CommentFilter,
  type MessageChange,
  type NewComment,
  type NewMessage,
  type PendingAttachment,
  type ReviewComment,
  type ReviewState,
} from "../../model/review";

export type {
  CommentFilter,
  MessageChange,
  NewComment,
  NewMessage,
  PendingAttachment,
  ReviewComment,
  ReviewState,
};

/** A rejected review request: the registry code, HTTP status and the server's message. */
export class ReviewApiError extends Error {
  readonly code: ErrorCode | "network_error" | "read_only";
  readonly status: number | null;
  /** Set on 401 `auth_required`: where to sign in again (S18). */
  readonly signInUrl: string | null;

  constructor(
    code: ReviewApiError["code"],
    message: string,
    status: number | null,
    signInUrl: string | null = null
  ) {
    super(message);
    this.name = "ReviewApiError";
    this.code = code;
    this.status = status;
    this.signInUrl = signInUrl;
  }
}

export function isReviewApiError(
  value: unknown,
  code?: ReviewApiError["code"]
): value is ReviewApiError {
  return value instanceof ReviewApiError && (code === undefined || value.code === code);
}

const reviewStateSchema = z.object({
  key: z.string(),
  status: z.enum(["in_review", "approved"]),
  updatedAt: z.string().nullable(),
  open: z.number().int().nonnegative(),
  events: z.array(eventSchema),
});

/** A server-side credential (remote only; scopes are always `["comment"]`). */
export const credentialSchema = z.object({
  id: z.string(),
  name: z.string(),
  scopes: z.array(z.enum(["review", "comment"])),
  createdAt: z.string().optional(),
  lastUsedAt: z.string().nullable().optional(),
});
export type Credential = z.infer<typeof credentialSchema>;
/** A credential right after creation: the token is shown once and never again. */
export type CreatedCredential = Credential & { token: string };

export type ReviewApi = {
  /** False for read-only snapshots: every write rejects with `read_only`. */
  readonly writable: boolean;
  listComments(filter?: CommentFilter): Promise<ReviewComment[]>;
  getComment(id: string): Promise<ReviewComment>;
  addComment(key: string, input: NewComment): Promise<ReviewComment>;
  reply(id: string, input: NewMessage): Promise<ReviewComment>;
  /** Resolve or reopen; a note is a reply written in the same mutation. */
  setStatus(id: string, status: "open" | "resolved", note?: NewMessage): Promise<ReviewComment>;
  editMessage(id: string, messageId: string, change: MessageChange): Promise<ReviewComment>;
  deleteComment(id: string): Promise<void>;
  /** Uploads one image as a pending attachment of `key` (claimed when a message is sent). */
  upload(key: string, file: Blob, name?: string): Promise<PendingAttachment>;
  /** Discards an unclaimed upload (composer cancel). */
  discard(key: string, attachmentId: string): Promise<void>;
  /** URL of an attachment's bytes (served as a download, `nosniff`). */
  attachmentUrl(key: string, attachment: { id: string; type: string; url?: string }): string;
  review(key: string): Promise<ReviewState>;
  /** Approve (`confirmOpen` when comments are open) or reopen a key. */
  transition(
    key: string,
    to: "approved" | "in_review",
    options?: { confirmOpen?: boolean }
  ): Promise<ReviewState>;
  /** Remote only: the signed-in principal (null when the session ended). */
  session(): Promise<BootstrapPrincipal | null>;
  /** Remote only, browser sessions: the principal's own credentials. */
  listCredentials(): Promise<Credential[]>;
  createCredential(name: string): Promise<CreatedCredential>;
  revokeCredential(id: string): Promise<void>;
  /** Remote only: a 60-second render ticket for the render origin (`?ticket=`). */
  renderTicket(slug: string, state?: string): Promise<string>;
};

export type ReviewApiOptions = {
  /** Bootstrap `apiBase`, resolved against `base`. */
  apiBase: string;
  base?: string;
  /** Called on 401 `auth_required` (session expired) with the server's sign-in URL. */
  onAuthRequired?: (signInUrl: string | null) => void;
  fetch?: typeof fetch;
};

const errorEnvelope = z.object({
  error: z.looseObject({ code: z.string(), message: z.string(), signInUrl: z.string().optional() }),
});

function knownCode(code: string): ErrorCode | null {
  return Object.hasOwn(errors, code) ? (code as ErrorCode) : null;
}

/** Client of the dev router or the remote review server. */
export function createReviewApi(options: ReviewApiOptions): ReviewApi {
  const base = new URL(options.apiBase, options.base ?? document.baseURI);
  const send = options.fetch ?? ((input, init) => fetch(input, init));
  const url = (path: string, query?: Record<string, string | undefined>) => {
    const target = new URL(path, base);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) target.searchParams.set(key, value);
    }
    return target;
  };

  async function request(
    method: string,
    path: string,
    init: { query?: Record<string, string | undefined>; json?: unknown; body?: BodyInit } = {}
  ): Promise<unknown> {
    const headers = new Headers({ accept: "application/json" });
    if (method !== "GET") headers.set("X-Proto-Request", "1");
    let body = init.body;
    if (init.json !== undefined) {
      headers.set("content-type", "application/json");
      body = JSON.stringify(init.json);
    }
    let response: Response;
    try {
      response = await send(url(path, init.query), {
        method,
        headers,
        body,
        credentials: "same-origin",
        redirect: "error",
      });
    } catch (error) {
      throw new ReviewApiError("network_error", String(error), null);
    }
    if (response.status === 204) return null;
    const payload: unknown = await response.json().catch(() => null);
    if (response.ok) return payload;
    const envelope = errorEnvelope.safeParse(payload);
    const code = envelope.success ? knownCode(envelope.data.error.code) : null;
    const failure = new ReviewApiError(
      code ?? "internal_error",
      envelope.success ? envelope.data.error.message : `The review API answered ${response.status}`,
      response.status,
      envelope.success ? (envelope.data.error.signInUrl ?? null) : null
    );
    if (response.status === 401 && (code === "auth_required" || code === null)) {
      options.onAuthRequired?.(failure.signInUrl);
    }
    throw failure;
  }

  const comment = (value: unknown) => z.object({ comment: commentSchema }).parse(value).comment;
  const state = (value: unknown) => z.object({ review: reviewStateSchema }).parse(value).review;
  const id = encodeURIComponent;

  return {
    writable: true,
    async listComments(filter = {}) {
      const query = Object.fromEntries(
        Object.entries(filter).map(([key, value]) => [
          key,
          value === undefined ? undefined : String(value),
        ])
      );
      const body = await request("GET", "comments", { query });
      return z.object({ comments: z.array(commentSchema) }).parse(body).comments;
    },
    async getComment(commentId) {
      return comment(await request("GET", `comments/${id(commentId)}`));
    },
    async addComment(key, input) {
      return comment(await request("POST", "comments", { json: { ...input, key } }));
    },
    async reply(commentId, input) {
      return comment(await request("POST", `comments/${id(commentId)}/replies`, { json: input }));
    },
    async setStatus(commentId, status, note) {
      return comment(
        await request("PATCH", `comments/${id(commentId)}/status`, { json: { status, note } })
      );
    },
    async editMessage(commentId, messageId, change) {
      return comment(
        await request("PATCH", `comments/${id(commentId)}/messages/${id(messageId)}`, {
          json: change,
        })
      );
    },
    async deleteComment(commentId) {
      await request("DELETE", `comments/${id(commentId)}`);
    },
    async upload(key, file, name) {
      const form = new FormData();
      form.set("file", file, name ?? (file instanceof File ? file.name : "image"));
      const body = await request("POST", "attachments", { query: { key }, body: form });
      return z.object({ attachment: pendingAttachmentSchema }).parse(body).attachment;
    },
    async discard(key, attachmentId) {
      await request("DELETE", `attachments/${id(key)}/${id(attachmentId)}`);
    },
    attachmentUrl(key, attachment) {
      return url(`attachments/${id(key)}/${id(attachment.id)}`).href;
    },
    async review(key) {
      return state(await request("GET", `reviews/${id(key)}`));
    },
    async transition(key, to, transition = {}) {
      return state(
        await request("POST", `reviews/${id(key)}/transitions`, {
          json: { to, confirmOpen: transition.confirmOpen },
        })
      );
    },
    async session() {
      try {
        const body = await request("GET", "session");
        return z.object({ principal: principalSchema.nullable() }).parse(body).principal;
      } catch (error) {
        if (isReviewApiError(error, "auth_required")) return null;
        throw error;
      }
    },
    async listCredentials() {
      const body = await request("GET", "credentials");
      return z.object({ credentials: z.array(credentialSchema) }).parse(body).credentials;
    },
    async createCredential(name) {
      const body = await request("POST", "credentials", { json: { name } });
      // The server answers `{ credential, token }`: the token is shown once and never stored.
      const created = z.object({ credential: credentialSchema, token: z.string() }).parse(body);
      return { ...created.credential, token: created.token };
    },
    async revokeCredential(credentialId) {
      await request("DELETE", `credentials/${id(credentialId)}`);
    },
    async renderTicket(slug, renderState) {
      const body = await request("GET", "render-ticket", { query: { slug, state: renderState } });
      return z.object({ ticket: z.string() }).parse(body).ticket;
    },
  };
}

/** File extensions of the review directory layout (`<key>/attachments/<id>.<ext>`). */
const extensions: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const readOnly = () =>
  Promise.reject(new ReviewApiError("read_only", "This build is read-only.", null));

/** A static review snapshot of one key (`proto build` with `build.includeReview`). */
export const reviewSnapshotSchema = z.object({
  key: z.string(),
  comments: z.array(commentSchema),
  review: reviewStateSchema,
});
export type ReviewSnapshot = z.infer<typeof reviewSnapshotSchema>;

/**
 * Read-only build with `build.includeReview`: comments and review states come from the static
 * snapshots `<reviewSnapshotBase><key>.json` (`{ key, comments, review }`); images from each
 * attachment's document-relative `url` (else `<key>/attachments/<id>.<ext>`). Writes reject
 * with `read_only`.
 */
export function snapshotApi(options: {
  reviewSnapshotBase: string;
  /** Every review key of the registry (prototype slugs and `flow-<id>`). */
  keys: readonly string[];
  base?: string;
  fetch?: typeof fetch;
}): ReviewApi {
  const base = new URL(options.reviewSnapshotBase, options.base ?? document.baseURI);
  const send = options.fetch ?? ((input, init) => fetch(input, init));
  const files = new Map<string, Promise<ReviewSnapshot | null>>();
  const file = (key: string) => {
    let pending = files.get(key);
    if (!pending) {
      pending = send(new URL(`${encodeURIComponent(key)}.json`, base), {
        headers: { accept: "application/json" },
      })
        .then(response => (response.ok ? response.json() : null))
        .then(body => (body ? reviewSnapshotSchema.parse(body) : null))
        .catch(() => null);
      files.set(key, pending);
    }
    return pending;
  };
  const all = async () =>
    (await Promise.all(options.keys.map(file))).flatMap(found => (found ? [found] : []));
  const notFound = () =>
    new ReviewApiError("comment_not_found", errors.comment_not_found.message, 404);
  return {
    writable: false,
    async listComments(filter = {}) {
      const comments = (await all()).flatMap(found => found.comments);
      return comments.filter(
        item =>
          (!filter.key || item.slug === filter.key) &&
          (!filter.state || item.context.state === filter.state) &&
          (filter.status === "all" || item.status === (filter.status ?? "open")) &&
          (!filter.authorKind || item.thread[0]?.author === filter.authorKind) &&
          (filter.waiting === undefined ||
            (item.thread.at(-1)?.author === "agent") === filter.waiting)
      );
    },
    async getComment(commentId) {
      const found = (await all())
        .flatMap(item => item.comments)
        .find(item => item.id === commentId);
      if (!found) throw notFound();
      return found;
    },
    addComment: readOnly,
    reply: readOnly,
    setStatus: readOnly,
    editMessage: readOnly,
    deleteComment: readOnly,
    upload: readOnly,
    discard: readOnly,
    attachmentUrl(key, attachment: { id: string; type: string; url?: string }) {
      if (attachment.url) return new URL(attachment.url, options.base ?? document.baseURI).href;
      const extension = extensions[attachment.type] ?? "bin";
      return new URL(
        `${encodeURIComponent(key)}/attachments/${encodeURIComponent(attachment.id)}.${extension}`,
        base
      ).href;
    },
    async review(key) {
      const found = await file(key);
      return found?.review ?? { key, status: "in_review", updatedAt: null, open: 0, events: [] };
    },
    transition: readOnly,
    session: async () => null,
    listCredentials: readOnly,
    createCredential: readOnly,
    revokeCredential: readOnly,
    renderTicket: readOnly,
  };
}
