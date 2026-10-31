/**
 * Review comments anchored to a rendered prototype or to a flow. Shared by the gallery (browser),
 * the dev-server API and the agent CLI (`node/`, `cli/`), so it holds types and pure helpers
 * only: no DOM and no Node APIs.
 *
 * Persistence uses the shared v3 model under `<app>/proto/review/<key>.json`.
 * These pure UI helpers remain here until the prebuilt shell replacement lands.
 */

// Compatibility re-exports while the prebuilt shell switches to the shared v3 model.
import type {
  CommentStatus,
  CommentAuthor,
  Rect,
  CommentContext,
  CommentTarget,
  ReviewComment,
  NewComment,
} from "../../model/review.ts";
export type {
  CommentStatus,
  CommentAuthor,
  Rect,
  CommentContext,
  ElementTarget,
  NodeTarget,
  CommentTarget,
  CommentAttachment,
  CommentMessage,
  ReviewComment,
  NewComment,
} from "../../model/review.ts";
export type CommentCounts = Record<string, { open: number; resolved: number }>;

/** Vite HMR event the dev server sends when a comments file changes. */
export const commentsEvent = "proto:comments";

export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Ids are `<slug>-<n>`, unique across files, so the CLI needs no slug. */
export function nextCommentId(slug: string, comments: ReviewComment[]) {
  const numbers = comments.map(comment => Number(comment.id.slice(slug.length + 1)) || 0);
  return `${slug}-${Math.max(0, ...numbers) + 1}`;
}

function rect(value: Rect): Rect {
  const round = (n: number) => Math.round(n * 10000) / 10000;
  return {
    x: round(value.x),
    y: round(value.y),
    width: round(value.width),
    height: round(value.height),
  };
}

/** Rebuilds a comment with a fixed key order, so files diff cleanly whoever writes them. */
function canonicalTarget(target: CommentTarget): CommentTarget {
  if (target.kind === "node") return { kind: "node", node: target.node, label: target.label };
  return {
    kind: target.kind,
    selector: target.selector,
    testId: target.testId,
    tag: target.tag,
    text: target.text,
    source: target.source,
    sourceChain: [...target.sourceChain],
    rect: rect(target.rect),
    rectNormalized: rect(target.rectNormalized),
    offset: target.offset ? rect(target.offset) : null,
  };
}

export function canonicalComment(comment: ReviewComment): ReviewComment {
  const { context, target } = comment;
  return {
    id: comment.id,
    slug: comment.slug,
    status: comment.status,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    resolvedAt: comment.resolvedAt,
    context: {
      commit: context.commit ?? null,
      state: context.state,
      theme: context.theme,
      role: context.role,
      viewport: { width: context.viewport.width, height: context.viewport.height },
    },
    target: canonicalTarget(target),
    thread: comment.thread.map(message => ({
      id: message.id,
      editedAt: message.editedAt,
      attachments: message.attachments.map(({ url: _url, ...image }) => image),
      author: message.author,
      body: message.body,
      at: message.at,
    })),
  };
}

export function createComment(
  slug: string,
  existing: ReviewComment[],
  input: NewComment,
  at: string
): ReviewComment {
  return canonicalComment({
    id: nextCommentId(slug, existing),
    slug,
    status: "open",
    createdAt: at,
    updatedAt: at,
    resolvedAt: null,
    context: input.context,
    target: input.target,
    thread: [
      {
        id: crypto.randomUUID(),
        editedAt: null,
        attachments: [],
        author: "reviewer",
        body: input.body.trim(),
        at,
      },
    ],
  });
}

export function withReply(
  comment: ReviewComment,
  author: CommentAuthor,
  body: string,
  at: string
): ReviewComment {
  return {
    ...comment,
    updatedAt: at,
    thread: [
      ...comment.thread,
      { id: crypto.randomUUID(), editedAt: null, attachments: [], author, body: body.trim(), at },
    ],
  };
}

export function withStatus(comment: ReviewComment, status: CommentStatus, at: string) {
  return {
    ...comment,
    status,
    updatedAt: at,
    resolvedAt: status === "resolved" ? at : null,
  } satisfies ReviewComment;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isRect = (value: unknown): value is Rect =>
  isRecord(value) &&
  isNumber(value.x) &&
  isNumber(value.y) &&
  isNumber(value.width) &&
  isNumber(value.height);
const isNullableString = (value: unknown) => value === null || typeof value === "string";

export function isMessageBody(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 10000;
}

/** Validates an untrusted `NewComment` body (dev-server API input). */
export function parseNewComment(value: unknown): NewComment | null {
  if (!isRecord(value) || !isMessageBody(value.body)) return null;
  const { context, target } = value;
  if (!isRecord(context) || !isRecord(target)) return null;
  const viewport = context.viewport;
  const validContext =
    (context.commit === undefined ||
      context.commit === null ||
      (typeof context.commit === "string" && /^[a-f0-9]{40}$/.test(context.commit))) &&
    typeof context.state === "string" &&
    isNullableString(context.theme) &&
    isNullableString(context.role) &&
    isRecord(viewport) &&
    isNumber(viewport.width) &&
    isNumber(viewport.height);
  const validNode =
    target.kind === "node" &&
    (target.node === null ||
      (typeof target.node === "string" &&
        slugPattern.test(target.node) &&
        target.node.length <= 120)) &&
    typeof target.label === "string" &&
    target.label.length <= 200;
  const validElement =
    (target.kind === "element" || target.kind === "region") &&
    typeof target.selector === "string" &&
    isNullableString(target.testId) &&
    typeof target.tag === "string" &&
    typeof target.text === "string" &&
    isNullableString(target.source) &&
    Array.isArray(target.sourceChain) &&
    target.sourceChain.every(item => typeof item === "string") &&
    isRect(target.rect) &&
    isRect(target.rectNormalized) &&
    (target.offset === null || isRect(target.offset));
  if (!validContext || !(validNode || validElement)) return null;
  const images = value.attachments;
  if (
    images !== undefined &&
    (!Array.isArray(images) ||
      !images.every(
        id => typeof id === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id)
      ))
  )
    return null;
  return {
    context: context as CommentContext,
    target: target as CommentTarget,
    body: value.body,
    attachments: images as string[] | undefined,
  };
}

/** Preserves thread ordering, original timestamps and resolution while editing one message. */
export function withEditedMessage(
  comment: ReviewComment,
  id: string,
  body: string,
  at: string
): ReviewComment {
  if (!isMessageBody(body)) throw new Error("Invalid message body");
  if (!comment.thread.some(message => message.id === id)) throw new Error("Message not found");
  return {
    ...comment,
    updatedAt: at,
    thread: comment.thread.map(message =>
      message.id === id ? { ...message, body: body.trim(), editedAt: at } : message
    ),
  };
}

/** One line naming what a comment points at, for the panel and the CLI. */
export function targetSummary(target: CommentTarget) {
  if (target.kind === "node")
    return target.node ? `step ${target.node} · ${target.label}` : "whole flow";
  return `<${target.tag}> ${target.text ? `“${target.text}”` : target.selector}`;
}

/** The repository file of a source tag (`apps/<app>/src/x.tsx:12:3` → `apps/<app>/src/x.tsx`). */
export function sourceFile(source: string | null): string | null {
  const file = source?.replace(/:\d+:\d+$/, "");
  return file && /^apps\/[a-zA-Z0-9_./-]+$/.test(file) && !file.split("/").includes("..")
    ? file
    : null;
}

export const commentNumber = (comment: ReviewComment) => comment.id.slice(comment.slug.length + 1);
