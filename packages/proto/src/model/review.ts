/** Review v3 wire and persistence contracts. Pure; shared by all store implementations. */
import { z } from "zod";
import { elementTargetSchema } from "./protocol.ts";
import { slugPattern } from "./registry.ts";
export { type ElementTarget, type Rect } from "./protocol.ts";
export const keySchema = z.string().regex(slugPattern).max(200);
export const commitSchema = z
  .string()
  .regex(/^[a-f0-9]{40}$/)
  .nullable();
const extra = z.record(z.string(), z.unknown()).optional();
export const authorSchema = z.object({
  kind: z.enum(["reviewer", "agent"]),
  id: z.string().min(1).optional(),
  name: z.string().optional(),
});
export type Author = z.infer<typeof authorSchema>;
export type CommentAuthor = Author["kind"];
export const contextSchema = z.object({
  commit: commitSchema.optional(),
  state: z.string(),
  theme: z.enum(["light", "dark"]).nullable(),
  role: z.string().nullable(),
  viewport: z.object({ width: z.number(), height: z.number() }),
  extra,
});
export type CommentContext = z.infer<typeof contextSchema>;
export const nodeTargetSchema = z.object({
  kind: z.literal("node"),
  node: z.string().nullable(),
  label: z.string(),
  extra,
});
export type NodeTarget = z.infer<typeof nodeTargetSchema>;
export const targetSchema = z.union([elementTargetSchema.extend({ extra }), nodeTargetSchema]);
export type CommentTarget = z.infer<typeof targetSchema>;
export const attachmentSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: z.string(),
  size: z.number().int().nonnegative(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
  url: z.string().optional(),
  uploaderId: z.string().optional(),
  uploaderKind: z.enum(["reviewer", "agent"]).optional(),
  extra,
});
export type CommentAttachment = z.infer<typeof attachmentSchema>;
export const messageSchema = z.object({
  id: z.string().min(1),
  at: z.string(),
  editedAt: z.string().nullable(),
  body: z.string(),
  author: z.enum(["reviewer", "agent"]),
  authorId: z.string().optional(),
  authorName: z.string().optional(),
  attachments: z.array(attachmentSchema),
  extra,
});
export type CommentMessage = z.infer<typeof messageSchema>;
export const commentSchema = z.object({
  id: z.string().min(1),
  slug: keySchema,
  status: z.enum(["open", "resolved"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  resolvedAt: z.string().nullable(),
  context: contextSchema,
  target: targetSchema,
  thread: z.array(messageSchema).min(1),
  extra,
});
export type ReviewComment = z.infer<typeof commentSchema>;
export type CommentStatus = ReviewComment["status"];
export const eventSchema = z.object({
  id: z.string(),
  type: z.enum(["approved", "reopened", "auto_reopened"]),
  at: z.string(),
  author: z.enum(["reviewer", "agent", "system"]),
  authorId: z.string().optional(),
  authorName: z.string().optional(),
  commit: commitSchema,
  openCount: z.number().int().nonnegative(),
  commentId: z.string().optional(),
  extra,
});
export type ReviewEvent = z.infer<typeof eventSchema>;
export const reviewFileSchema = z
  .object({
    version: z.literal(3),
    key: keySchema,
    sequence: z.number().int().nonnegative(),
    review: z.object({
      status: z.enum(["in_review", "approved"]),
      updatedAt: z.string().nullable(),
      extra,
    }),
    events: z.array(eventSchema),
    comments: z.array(commentSchema),
    extra,
  })
  .superRefine((file, ctx) => {
    const ids = new Set<string>();
    for (const comment of file.comments) {
      const number = Number(comment.id.slice(file.key.length + 1));
      if (
        comment.slug !== file.key ||
        !comment.id.startsWith(`${file.key}-`) ||
        !Number.isSafeInteger(number) ||
        number < 1 ||
        number > file.sequence ||
        ids.has(comment.id)
      )
        ctx.addIssue({ code: "custom", message: "Invalid comment identity or sequence" });
      ids.add(comment.id);
    }
  });
export type ReviewFileV3 = z.infer<typeof reviewFileSchema>;
export type ReviewState = {
  key: string;
  status: "in_review" | "approved";
  updatedAt: string | null;
  open: number;
  events: ReviewEvent[];
};
/** Static read-only export at __proto/review/<key>.json; attachment URLs are document-relative. */
export type ReviewSnapshot = { key: string; comments: ReviewComment[]; review: ReviewState };
const body = z.string().trim().min(1).max(10000);
const ids = z
  .array(z.string().uuid())
  .refine(value => new Set(value).size === value.length, "Duplicate attachment ids");
export const newMessageSchema = z.object({ body, attachments: ids.optional() });
export type NewMessage = z.infer<typeof newMessageSchema>;
export const newCommentSchema = newMessageSchema.extend({
  context: contextSchema,
  target: targetSchema,
});
export type NewComment = z.infer<typeof newCommentSchema>;
export const messageChangeSchema = z
  .object({ body: body.optional(), attach: ids.optional(), detach: ids.optional() })
  .refine(
    value => value.body !== undefined || Boolean(value.attach?.length || value.detach?.length),
    "Empty message update"
  );
export type MessageChange = z.infer<typeof messageChangeSchema>;
export const commentFilterSchema = z.object({
  key: keySchema.optional(),
  spec: z.string().optional(),
  state: z.string().optional(),
  status: z.enum(["open", "resolved", "all"]).optional(),
  authorKind: z.enum(["reviewer", "agent"]).optional(),
  waiting: z.boolean().optional(),
});
export type CommentFilter = z.infer<typeof commentFilterSchema>;
export type AttachmentInput = { name: string; bytes: Uint8Array; type?: string };
export const pendingAttachmentSchema = attachmentSchema.extend({
  expiresAt: z.string(),
  uploaderKind: z.enum(["reviewer", "agent"]),
});
export type PendingAttachment = z.infer<typeof pendingAttachmentSchema>;
export function emptyReviewFile(key: string): ReviewFileV3 {
  return {
    version: 3,
    key: keySchema.parse(key),
    sequence: 0,
    review: { status: "in_review", updatedAt: null },
    events: [],
    comments: [],
  };
}
/** Stable remote owner id wins; local ownership is the author kind, never a display name. */
export function owns(author: Author, kind: string | undefined, id?: string) {
  return id !== undefined || author.id !== undefined
    ? id !== undefined && id === author.id
    : author.kind === kind;
}
