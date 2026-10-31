/**
 * Review comments anchored to a rendered prototype or to a flow. Shared by the gallery (browser),
 * the dev-server API and the agent CLI (`node/`, `cli/`), so it holds types and pure helpers
 * only: no DOM and no Node APIs.
 *
 * One versionable file per prototype, `apps/<app>/gallery/comments/<slug>/comments.json`, and
 * per flow, under the reserved key `flow-<flow id>` (`flowKey` in `flow.ts`).
 */

export type CommentStatus = "open" | "resolved";
export type CommentAuthor = "reviewer" | "agent";

/** CSS pixels, or fractions of the canvas in `rectNormalized`/`offset`. */
export type Rect = { x: number; y: number; width: number; height: number };

/**
 * The view the reviewer was looking at; `theme`/`role` are the URL values (`dark`, `admin`). On
 * a flow, `state` is the selected step (node id), empty for the whole flow.
 */
export type CommentContext = {
  commit?: string | null;
  state: string;
  theme: string | null;
  role: string | null;
  viewport: { width: number; height: number };
};

/** A point of a rendered prototype: what the overlay pins and the CLI maps to source. */
export type ElementTarget = {
  /** `element` for a click, `region` for a dragged rectangle. */
  kind: "element" | "region";
  /** Re-finds the anchor element: `[data-testid=…]` based when possible, else a short DOM path. */
  selector: string;
  testId: string | null;
  tag: string;
  /** Visible text of the anchor, trimmed to 120 characters. */
  text: string;
  /**
   * Repository-relative JSX source, e.g. `apps/<app>/src/<area>/<file>.tsx:<line>:<column>`:
   * the clicked element, or what sits at the center of a region.
   */
  source: string | null;
  /**
   * Distinct source locations, most specific first (≤ 8): for a click, the JSX elements that
   * produced the node (components included, e.g. the prototype's `<PageHeader>` call); for a
   * region, what is drawn inside it, then the container's chain.
   */
  sourceChain: string[];
  /** Region in canvas (iframe viewport) pixels at capture time. */
  rect: Rect;
  /** `rect` as fractions of the canvas width and height. */
  rectNormalized: Rect;
  /** Region as fractions of the anchor's box, so the pin follows the element. Null for clicks. */
  offset: Rect | null;
};

/** A step of a flow (its node id, stable in the `.flow.ts` file), or the whole flow (`null`). */
export type NodeTarget = {
  kind: "node";
  node: string | null;
  /** What the step showed when the comment was written (`Sign in · Error`). */
  label: string;
};

export type CommentTarget = ElementTarget | NodeTarget;

export type CommentAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  width: number;
  height: number;
  url?: string;
};
export type CommentMessage = {
  id: string;
  editedAt: string | null;
  attachments: CommentAttachment[];
  author: CommentAuthor;
  body: string;
  at: string;
};

export type ReviewComment = {
  id: string;
  slug: string;
  status: CommentStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  context: CommentContext;
  target: CommentTarget;
  /** The first message is the note; the rest are replies. */
  thread: CommentMessage[];
};

export type CommentFile = { version: 2; slug: string; comments: ReviewComment[] };

export type CommentCounts = Record<string, { open: number; resolved: number }>;

/** Body of `POST /__comments/<slug>`. */
export type NewComment = {
  context: CommentContext;
  target: CommentTarget;
  body: string;
  attachments?: string[];
};

/** Vite HMR event the dev server sends when a comments file changes. */
export const commentsEvent = "proto:comments";

export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Ids are `<slug>-<n>`, unique across files, so the CLI needs no slug. */
export function nextCommentId(slug: string, comments: ReviewComment[]) {
  const numbers = comments.map(comment => Number(comment.id.slice(slug.length + 1)) || 0);
  return `${slug}-${Math.max(0, ...numbers) + 1}`;
}

function sequence(comment: ReviewComment) {
  return Number(comment.id.slice(comment.slug.length + 1)) || 0;
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

export function canonicalFile(slug: string, comments: ReviewComment[]): CommentFile {
  const ordered = comments.toSorted((a, b) => sequence(a) - sequence(b));
  return { version: 2, slug, comments: ordered.map(canonicalComment) };
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
