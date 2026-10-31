import type {
  Author,
  CommentFilter,
  ReviewComment,
  NewComment,
  NewMessage,
  MessageChange,
  AttachmentInput,
  PendingAttachment,
  ReviewState,
} from "../model/review.ts";
export type * from "../model/review.ts";
export interface ReviewStore {
  list(filter?: CommentFilter): Promise<ReviewComment[]>;
  get(id: string): Promise<ReviewComment>;
  add(key: string, input: NewComment, author: Author): Promise<ReviewComment>;
  reply(id: string, input: NewMessage, author: Author): Promise<ReviewComment>;
  setStatus(
    id: string,
    status: "open" | "resolved",
    author: Author,
    note?: NewMessage
  ): Promise<ReviewComment>;
  editMessage(
    id: string,
    messageId: string,
    change: MessageChange,
    author: Author
  ): Promise<ReviewComment>;
  remove(id: string, author: Author): Promise<void>;
  upload(key: string, file: AttachmentInput, author: Author): Promise<PendingAttachment>;
  discard(key: string, attachmentId: string, author: Author): Promise<void>;
  readAttachment(
    key: string,
    attachmentId: string
  ): Promise<{ bytes: Uint8Array; type: string; name: string }>;
  review(key: string): Promise<ReviewState>;
  transition(
    key: string,
    to: "approved" | "in_review",
    author: Author,
    options: { commit: string | null; confirmOpen?: boolean }
  ): Promise<ReviewState>;
  unlock(
    key: string,
    options: { force: true }
  ): Promise<{ removedOwner: { hostId: string; pid: number } | null }>; // local only
}
