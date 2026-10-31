/** Transitional CLI adapter. All persistence goes through the v3 FileStore. */
import { join, relative } from "node:path";
import { flowOfKey } from "../flow.ts";
import { newCommentSchema, type Author, type CommentAuthor } from "../model/review.ts";
import { FileStore } from "../store/file-store.ts";
import { findPrototypes } from "./discovery.ts";
import { findFlows } from "./flows.ts";
import { currentApp, repoRoot } from "./paths.ts";
export class CommentError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404
  ) {
    super(message);
  }
}
export function assertSlug(slug: string) {
  const { appRoot, config } = currentApp();
  const prototypes = findPrototypes(appRoot, repoRoot, config).entries;
  const flow = flowOfKey(slug);
  if (
    !(flow
      ? findFlows(appRoot, repoRoot, prototypes, config).flows.some(item => item.id === flow)
      : prototypes.some(item => item.slug === slug))
  )
    throw new CommentError(`Unknown review key "${slug}"`, 404);
}
export function localStore() {
  const { appRoot, config } = currentApp();
  return new FileStore({
    root: appRoot,
    registry: async () => {
      const entries = findPrototypes(appRoot, repoRoot, config).entries;
      return {
        prototypes: entries.map(item => ({ slug: item.slug, spec: item.meta?.spec ?? null })),
        flows: findFlows(appRoot, repoRoot, entries, config).flows.map(item => ({
          id: item.id,
          spec: item.spec ?? null,
        })),
      };
    },
  });
}
export const commentsDir = () => join(currentApp().appRoot, "proto/review");
export const commentsPath = (key: string) => join(commentsDir(), `${key}.json`);
export const displayPath = (key: string) => relative(repoRoot, commentsPath(key));
export const readComments = (key: string) => localStore().list({ key, status: "all" });
export async function commentedSlugs() {
  return [...new Set((await localStore().list({ status: "all" })).map(comment => comment.slug))];
}
export async function countComments() {
  const counts: Record<string, { open: number; resolved: number }> = {};
  for (const comment of await localStore().list({ status: "all" })) {
    counts[comment.slug] ??= { open: 0, resolved: 0 };
    counts[comment.slug]![comment.status]++;
  }
  return counts;
}
export const addComment = (key: string, input: unknown, author: Author = { kind: "agent" }) =>
  localStore().add(key, newCommentSchema.parse(input), author);
export const getComment = (id: string) => localStore().get(id);
export const replyTo = (
  id: string,
  author: CommentAuthor,
  body: string,
  attachments: string[] = []
) => localStore().reply(id, { body, attachments }, { kind: author });
export const setStatus = (
  id: string,
  status: "open" | "resolved",
  note?: { author: CommentAuthor; body: string }
) =>
  localStore().setStatus(
    id,
    status,
    { kind: note?.author ?? "agent" },
    note?.body.trim() ? { body: note.body } : undefined
  );
export async function removeComment(id: string) {
  const store = localStore();
  const comment = await store.get(id);
  await store.remove(id, { kind: "agent" });
  return comment;
}
export const editMessage = (
  id: string,
  messageId: string,
  input: { body?: string; addAttachments?: string[]; removeAttachments?: string[] },
  author: CommentAuthor = "agent"
) =>
  localStore().editMessage(
    id,
    messageId,
    { body: input.body, attach: input.addAttachments, detach: input.removeAttachments },
    { kind: author }
  );
export function attachmentStore(key: string) {
  const store = localStore();
  return {
    upload: (name: string, bytes: Uint8Array) =>
      store.upload(key, { name, bytes }, { kind: "agent" }),
    read: (id: string) => store.readAttachment(key, id),
    discard: (id: string) => store.discard(key, id, { kind: "agent" }),
  };
}
