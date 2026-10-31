/**
 * Message composer of new comments and replies (S8, S9): body, 0..6 images (pick, paste or
 * drop; uploaded at once as pending attachments of the review key and claimed on send),
 * ⌘/Ctrl+Enter sends, Esc cancels. A failed send keeps the draft and shows the error.
 */
import { useRef, useState, type ReactNode } from "react";

import { useT, type Translate } from "../../lib/i18n";
import { Button } from "../../ui/button";
import { Textarea } from "../../ui/textarea";
import { cn } from "../../ui/utils";
import { useReviewApi } from "../data";
import { useDraft } from "../drafts";
import { Paperclip, Send, X } from "./icons";
import { imageTypes, maxImages, useAttachments, type UploadProblem } from "./use-attachments";

export type ComposerProps = {
  /** Pending uploads go to `POST attachments?key=<reviewKey>`. */
  reviewKey: string;
  submitLabel: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** Rejecting keeps the draft and shows the error's message. */
  onSubmit: (input: { body: string; attachments: string[] }) => Promise<void>;
  /** Pending uploads are discarded. */
  onCancel?: () => void;
  className?: string;
  /** Rendered above the body (the new-comment header). */
  header?: ReactNode;
  /** Keeps the unsent text under this scope across reloads and expired sessions (S18). */
  draftScope?: string;
};

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function problemText(t: Translate, problem: UploadProblem, name: string, size: number) {
  if (problem === "attachment_too_large")
    return t("composer.tooLarge", { name, size: megabytes(size) });
  if (problem === "attachment_type") return t("composer.type", { name });
  if (problem === "attachment_limit") return t("composer.limit", { max: maxImages });
  if (problem === "attachment_expired") return t("composer.expired", { name });
  return t("composer.uploadFailed", { name });
}

export function Composer({
  reviewKey,
  submitLabel,
  placeholder,
  autoFocus,
  onSubmit,
  onCancel,
  className,
  header,
  draftScope,
}: ComposerProps) {
  const t = useT();
  const api = useReviewApi();
  const uploads = useAttachments(api, reviewKey);
  const [body, setBody, clearDraft] = useDraft(draftScope ?? `new:${reviewKey}`);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const canSend = body.trim().length > 0 && uploads.ready && !sending;

  const submit = async () => {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      await onSubmit({ body: body.trim(), attachments: uploads.ids });
      uploads.claimed();
      clearDraft();
    } catch (reason) {
      setError(
        t("composer.failed", { message: reason instanceof Error ? reason.message : String(reason) })
      );
      setSending(false);
    }
  };

  const failed = uploads.items.find(item => item.problem);
  const problem = uploads.refused
    ? problemText(t, uploads.refused.problem, uploads.refused.name, uploads.refused.size)
    : failed?.problem
      ? problemText(t, failed.problem, failed.name, failed.size)
      : null;

  return (
    <form
      data-testid="comment-composer"
      className={cn("flex flex-col", className)}
      onSubmit={event => {
        event.preventDefault();
        void submit();
      }}
      onKeyDown={event => {
        if (event.key === "Escape" && onCancel) {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        }
      }}
      onPaste={event => {
        const files = [...event.clipboardData.files].filter(file => file.type.startsWith("image/"));
        if (files.length) {
          event.preventDefault();
          uploads.add(files);
        }
      }}
      onDragOver={event => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDrop={event => {
        if (!event.dataTransfer.files.length) return;
        event.preventDefault();
        uploads.add([...event.dataTransfer.files]);
      }}
    >
      {header}
      <Textarea
        autoFocus={autoFocus}
        value={body}
        aria-label={placeholder ?? t("composer.placeholder")}
        placeholder={placeholder ?? t("composer.placeholder")}
        onChange={event => setBody(event.target.value)}
        onKeyDown={event => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void submit();
          }
        }}
        className="mt-2.5 min-h-20 resize-none bg-background text-[13px]"
      />
      {uploads.items.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={t("composer.attach")}>
          {uploads.items.map(item => (
            <li key={item.id} className="relative">
              <img
                src={item.preview}
                alt={item.name}
                className={cn(
                  "size-11 rounded-md object-cover ring-1 ring-border",
                  item.status === "uploading" && "opacity-50",
                  item.status === "failed" && "opacity-40 ring-destructive"
                )}
              />
              {item.status === "uploading" && (
                <span className="sr-only">{t("composer.uploading", { name: item.name })}</span>
              )}
              <button
                type="button"
                aria-label={t("composer.remove", { name: item.name })}
                onClick={() => uploads.remove(item.id)}
                className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-background ring-1 ring-border hover:text-foreground"
              >
                <X className="size-2.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {problem && (
        <p role="alert" className="mt-2 text-[11px] text-destructive">
          {problem}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[11px] text-destructive">
          {error}
        </p>
      )}
      <div className="mt-2.5 flex items-center gap-1">
        <input
          ref={picker}
          type="file"
          accept={imageTypes.join(",")}
          multiple
          hidden
          data-testid="composer-file"
          onChange={event => {
            uploads.add([...(event.target.files ?? [])]);
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t("composer.attach")}
          disabled={uploads.items.length >= maxImages}
          onClick={() => picker.current?.click()}
        >
          <Paperclip />
        </Button>
        <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
          {t("composer.count", { count: uploads.items.length, max: maxImages })}
        </span>
        {onCancel && (
          <Button type="button" variant="ghost" size="xs" className="ml-auto" onClick={onCancel}>
            {t("composer.cancel")}
          </Button>
        )}
        <Button
          type="submit"
          size="xs"
          className={cn("font-semibold", !onCancel && "ml-auto")}
          disabled={!canSend}
        >
          <Send data-icon="inline-start" />
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
