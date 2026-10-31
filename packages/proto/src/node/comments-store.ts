/**
 * Reads and writes the review comments of each prototype in
 * `apps/<app>/gallery/comments/<slug>/comments.json`.
 * Used by the dev-server API (`comments-plugin.ts`) and the agent CLI (`proto comments`), so
 * the files stay the single source of truth with or without the dev server.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";

import { flowOfKey } from "../flow.ts";
import { AttachmentStore } from "./attachments-store.ts";
import { findPrototypes } from "./discovery.ts";
import { findFlows } from "./flows.ts";
import { currentApp, repoRoot } from "./paths.ts";

import {
  isMessageBody,
  canonicalFile,
  canonicalComment,
  withEditedMessage,
  createComment,
  slugPattern,
  withReply,
  withStatus,
  type CommentAuthor,
  type CommentCounts,
  type CommentFile,
  type CommentStatus,
  type NewComment,
  type ReviewComment,
} from "../shell/comments/model.ts";

/** `apps/<app>/gallery/comments` of the loaded app. */
export const commentsDir = () => currentApp().commentsRoot;
const fileName = "comments.json";

export class CommentError extends Error {
  readonly status: 400 | 404;

  constructor(message: string, status: 400 | 404) {
    super(message);
    this.status = status;
  }
}

export function requireMessageBody(value: unknown): string {
  if (!isMessageBody(value)) throw new CommentError("Invalid message body", 400);
  return value.trim();
}

/** Throws unless `slug` names an existing prototype, or `flow-<id>` an existing flow. */
export function assertSlug(slug: string) {
  const { appRoot, config } = currentApp();
  const prototypes = slugPattern.test(slug)
    ? findPrototypes(appRoot, repoRoot, config).entries
    : [];
  const flow = flowOfKey(slug);
  const known = flow
    ? findFlows(appRoot, repoRoot, prototypes, config).flows.some(item => item.id === flow)
    : prototypes.some(entry => entry.slug === slug);
  if (!known) {
    throw new CommentError(`Unknown ${flow ? "flow" : "prototype"} "${flow ?? slug}"`, 404);
  }
}

export function commentsPath(slug: string) {
  return join(commentsDir(), slug, fileName);
}

/** Repo-relative path, for messages. */
export function displayPath(slug: string) {
  return relative(repoRoot, commentsPath(slug));
}

export function readComments(slug: string): ReviewComment[] {
  assertSlug(slug);
  const path = commentsPath(slug);
  if (!existsSync(path)) return [];
  const file = JSON.parse(readFileSync(path, "utf8")) as CommentFile;
  return file.comments.map(comment => {
    const normalized = canonicalComment(comment);
    return {
      ...normalized,
      thread: normalized.thread.map(message => ({
        ...message,
        attachments: message.attachments.map(image => ({
          ...image,
          url: `/__comments/${slug}/attachments/${image.id}`,
        })),
      })),
    };
  });
}

/** Writes the canonical file (sorted, fixed key order, 4-space JSON); removes it when empty. */
export function writeComments(slug: string, comments: ReviewComment[]) {
  assertSlug(slug);
  const path = commentsPath(slug);
  if (comments.length === 0) {
    rmSync(path, { force: true });
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(canonicalFile(slug, comments), null, 4)}\n`);
  renameSync(temporary, path);
}

/** Slugs that have a comments file, alphabetically. */
export function commentedSlugs() {
  const root = commentsDir();
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && existsSync(join(root, entry.name, fileName)))
    .map(entry => entry.name)
    .toSorted();
}

export function countComments(): CommentCounts {
  const counts: CommentCounts = {};
  for (const slug of commentedSlugs()) {
    const comments = readComments(slug);
    counts[slug] = {
      open: comments.filter(comment => comment.status === "open").length,
      resolved: comments.filter(comment => comment.status === "resolved").length,
    };
  }
  return counts;
}

/** Ids are `<slug>-<n>` (`account-settings-2`). */
export function slugOfId(id: string) {
  const match = /^(.+)-\d+$/.exec(id);
  if (!match?.[1]) throw new CommentError(`Invalid comment id "${id}"`, 400);
  return match[1];
}

function update(id: string, change: (comment: ReviewComment) => ReviewComment | null) {
  const slug = slugOfId(id);
  const comments = readComments(slug);
  const index = comments.findIndex(comment => comment.id === id);
  const current = comments[index];
  if (!current) throw new CommentError(`Comment "${id}" not found`, 404);
  const next = change(current);
  const rest = comments.filter(comment => comment.id !== id);
  writeComments(slug, next ? [...rest, next] : rest);
  return next ?? current;
}

const now = () => new Date().toISOString();

export function addComment(slug: string, input: NewComment) {
  requireMessageBody(input.body);
  const comments = readComments(slug);
  const comment = createComment(slug, comments, input, now());
  attachmentStore(slug).commit([], input.attachments ?? [], [], images => {
    comment.thread[0]!.attachments = images;
    writeComments(slug, [...comments, comment]);
  });
  return comment;
}

export function getComment(id: string) {
  const comment = readComments(slugOfId(id)).find(item => item.id === id);
  if (!comment) throw new CommentError(`Comment "${id}" not found`, 404);
  return comment;
}

export function replyTo(
  id: string,
  author: CommentAuthor,
  body: string,
  attachments: string[] = []
) {
  requireMessageBody(body);
  const slug = slugOfId(id);
  let result: ReviewComment | undefined;
  attachmentStore(slug).commit([], attachments, [], images => {
    result = update(id, comment => {
      const next = withReply(comment, author, body, now());
      next.thread.at(-1)!.attachments = images;
      return next;
    });
  });
  return result!;
}

/** Changes the status, optionally adding a reply in the same write (resolve with a note). */
export function setStatus(
  id: string,
  status: CommentStatus,
  note?: { author: CommentAuthor; body: string }
) {
  // The CLI passes an empty string when reopening without a note.
  if (note && note.body !== "") requireMessageBody(note.body);
  return update(id, comment => {
    const at = now();
    const replied = note?.body.trim() ? withReply(comment, note.author, note.body, at) : comment;
    return withStatus(replied, status, at);
  });
}

export function removeComment(id: string) {
  const comment = update(id, () => null);
  attachmentStore(comment.slug).remove(comment.thread.flatMap(message => message.attachments));
  return comment;
}

export function attachmentStore(slug: string) {
  assertSlug(slug);
  return new AttachmentStore(join(commentsDir(), slug), commentsDir());
}
export function editMessage(
  id: string,
  messageId: string,
  input: { body?: string; addAttachments?: string[]; removeAttachments?: string[] }
) {
  if (input.body === undefined && !input.addAttachments?.length && !input.removeAttachments?.length)
    throw new CommentError("Empty message update", 400);
  const current = getComment(id);
  const message = current.thread.find(message => message.id === messageId);
  if (!message) throw new CommentError("Message not found", 404);
  const body = requireMessageBody(input.body === undefined ? message.body : input.body);
  let result: ReviewComment | undefined;
  attachmentStore(current.slug).commit(
    message.attachments,
    input.addAttachments ?? [],
    input.removeAttachments ?? [],
    images => {
      result = update(id, comment => {
        const next = withEditedMessage(comment, messageId, body, now());
        const edited = next.thread.find(message => message.id === messageId);
        if (!edited) throw new CommentError("Message not found", 404);
        edited.attachments = images;
        return next;
      });
    }
  );
  return result!;
}
