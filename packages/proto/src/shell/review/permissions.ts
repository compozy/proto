/**
 * What the shell's principal may do, restating `_spec.md` § Authorization Matrix for the UI
 * (the router enforces it): the shell is a browser session — locally the trusted `reviewer`,
 * remotely the signed-in person. Controls a principal may not use are absent, not disabled.
 */
import type { Bootstrap } from "../../model/bootstrap";
import { owns, type Author, type CommentAttachment, type CommentMessage } from "../../model/review";

export type Permissions = {
  /** Add, reply, resolve, reopen. */
  comment: boolean;
  /** Delete a comment: dev, or a session with the `review` scope. */
  delete: boolean;
  /** Approve or reopen a review: dev (trust), or a `review` session; never agents. */
  approve: boolean;
  /** Create, list and revoke own credentials: remote browser sessions only. */
  credentials: boolean;
  /** The author identity ownership is checked against. */
  author: Author;
};

export function permissionsOf(bootstrap: Bootstrap, writable: boolean): Permissions {
  const principal = bootstrap.principal;
  if (bootstrap.mode === "dev") {
    const author: Author = { kind: "reviewer" };
    return { comment: writable, delete: writable, approve: writable, credentials: false, author };
  }
  if (bootstrap.mode !== "remote" || !principal || !writable) {
    return {
      comment: false,
      delete: false,
      approve: false,
      credentials: false,
      author: { kind: "reviewer" },
    };
  }
  const review = principal.scopes.includes("review");
  const agent = principal.kind === "agent";
  return {
    comment: principal.scopes.includes("comment") || review,
    delete: review && !agent,
    approve: review && !agent,
    credentials: !agent && principal.credentialId === null,
    author: { kind: principal.kind, id: principal.id, name: principal.name },
  };
}

/** Edit or detach only on the principal's own messages (remote: by owner id). */
export function ownsMessage(permissions: Permissions, message: CommentMessage) {
  return permissions.comment && owns(permissions.author, message.author, message.authorId);
}

export function ownsUpload(
  permissions: Permissions,
  message: CommentMessage,
  image: CommentAttachment
) {
  return (
    permissions.comment &&
    owns(
      permissions.author,
      image.uploaderKind ?? message.author,
      image.uploaderId ?? message.authorId
    )
  );
}
