import { useAttachments } from "./use-attachments";
import { useState } from "react";
import { Button } from "@proto/ui/components/button";
import { Textarea } from "@proto/ui/components/textarea";
import { AttachmentInput, AttachmentImages } from "./attachments";
import { commentsApi } from "./api";
import type { CommentMessage } from "./model";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "short", timeStyle: "short" });
const authors = { reviewer: "Reviewer", agent: "Agent" };

/** Editing stays local until Save succeeds; cancellation leaves the persisted message intact. */
export function Message({
  slug,
  commentId,
  message,
}: {
  slug: string;
  commentId: string;
  message: CommentMessage;
}) {
  const uploads = useAttachments(slug);
  const [removed, setRemoved] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(message.body);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const removedIds = new Set(removed);
  const images = message.attachments.filter(image => !removedIds.has(image.id));
  function cancel() {
    uploads.cancel();
    setEditing(false);
  }
  function save() {
    if (!uploads.ready || !body.trim()) return;
    setPending(true);
    setError(null);
    void commentsApi
      .edit(slug, commentId, message.id, {
        body,
        addAttachments: uploads.ids,
        removeAttachments: removed,
      })
      .then(
        () => {
          uploads.committed();
          setEditing(false);
        },
        () => setError("Could not save. Check that the message still exists and try again.")
      )
      .finally(() => setPending(false));
  }
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">{authors[message.author]}</span>
        {" · "}
        {dateFormat.format(new Date(message.at))}
        {message.editedAt ? (
          <span title={dateFormat.format(new Date(message.editedAt))}> · edited</span>
        ) : null}
      </span>
      {editing ? (
        <form
          className="grid gap-2"
          onSubmit={event => {
            event.preventDefault();
            save();
          }}
          onKeyDown={event => {
            if (event.key === "Escape" && !pending) {
              event.preventDefault();
              cancel();
            }
          }}
        >
          <Textarea
            aria-label="Edit message"
            value={body}
            onChange={event => setBody(event.target.value)}
            onPaste={event => {
              if (event.clipboardData.files.length) {
                event.preventDefault();
                uploads.add(
                  [...event.clipboardData.files],
                  6 - message.attachments.length + removed.length
                );
              }
            }}
            maxLength={10000}
            disabled={pending}
          />
          <AttachmentImages images={images} />
          {images.map(image => (
            <Button
              key={image.id}
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => setRemoved(previous => [...previous, image.id])}
            >
              Remove {image.name}
            </Button>
          ))}
          <AttachmentInput
            uploads={uploads}
            disabled={pending}
            capacity={6 - message.attachments.length + removed.length}
          />
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending || !body.trim() || !uploads.ready}>
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={cancel}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          <p className="text-[13px] leading-snug whitespace-pre-wrap">{message.body}</p>
          <AttachmentImages images={message.attachments} />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="self-start"
            onClick={() => {
              setBody(message.body);
              setRemoved([]);
              setError(null);
              setEditing(true);
            }}
          >
            Edit
          </Button>
        </>
      )}
    </div>
  );
}
