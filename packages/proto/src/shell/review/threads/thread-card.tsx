/**
 * S9 thread: the numbered comment with its author, source chip (and the JSX source chain), the
 * messages with images, then — when focused and writable — reply, resolve with an optional note,
 * reopen and delete. Edit and detach appear only on the principal's own messages and uploads.
 */
import { useState } from "react";

import type { CommentAttachment, CommentMessage, ReviewComment } from "../../../model/review";
import { useLocale, useT } from "../../lib/i18n";
import { Avatar, AvatarFallback } from "../../ui/avatar";
import { Button } from "../../ui/button";
import {
  Bot,
  CircleCheck,
  Code,
  CornerDownRight,
  Pencil,
  RotateCcw,
  Trash2,
  X,
} from "../../ui/icons";
import { Textarea } from "../../ui/textarea";
import { cn } from "../../ui/utils";
import { isReviewApiError } from "../api";
import { useReviewData, useReviewMutation } from "../data";
import { authorName, commentNumber, initials, relativeTime, shortSource } from "../format";
import { ownsMessage, ownsUpload } from "../permissions";
import { Composer } from "./composer";

export function CommentNumber({
  comment,
  className,
}: {
  comment: ReviewComment;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-full font-mono text-[10px] font-semibold",
        comment.status === "open"
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground",
        className
      )}
    >
      {commentNumber(comment)}
    </span>
  );
}

function Author({ message }: { message: CommentMessage }) {
  const t = useT();
  const name = authorName(message, { reviewer: t("review.reviewer"), agent: t("review.agent") });
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar className="size-5">
        <AvatarFallback
          className={cn(
            "text-[9px] font-semibold",
            message.author === "agent"
              ? "bg-[var(--shell-primary-soft)] text-primary"
              : "bg-muted text-foreground"
          )}
        >
          {message.author === "agent" ? (
            <Bot className="size-3" aria-hidden="true" />
          ) : (
            initials(name)
          )}
        </AvatarFallback>
      </Avatar>
      <span className="truncate text-[13px] font-medium">{name}</span>
      {message.author === "agent" && <span className="sr-only">({t("review.agent")})</span>}
    </span>
  );
}

function Time({ at }: { at: string }) {
  const locale = useLocale();
  return (
    <time
      dateTime={at}
      title={new Date(at).toLocaleString(locale)}
      className="ml-auto shrink-0 text-[11px] whitespace-nowrap text-muted-foreground"
    >
      {relativeTime(at, locale)}
    </time>
  );
}

function Images({ comment, message }: { comment: ReviewComment; message: CommentMessage }) {
  const t = useT();
  const review = useReviewData();
  const mutate = useReviewMutation();
  if (!review || !message.attachments.length) return null;
  const detach = (image: CommentAttachment) =>
    mutate(comment.slug, api => api.editMessage(comment.id, message.id, { detach: [image.id] }));
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {message.attachments.map(image => {
        const url = review.api.attachmentUrl(comment.slug, image);
        return (
          <li key={image.id} className="relative">
            <a
              href={url}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={t("thread.openImage", { name: image.name })}
            >
              <img
                src={url}
                alt={image.name}
                loading="lazy"
                className="size-14 rounded-md border border-border object-cover"
              />
            </a>
            {ownsUpload(review.permissions, message, image) && (
              <button
                type="button"
                aria-label={t("thread.detach", { name: image.name })}
                onClick={() => void detach(image)}
                className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full border border-border bg-background text-muted-foreground hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function MessageBody({ comment, message }: { comment: ReviewComment; message: CommentMessage }) {
  const t = useT();
  const review = useReviewData();
  const mutate = useReviewMutation();
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const own = review ? ownsMessage(review.permissions, message) : false;
  const save = async () => {
    if (editing === null || !editing.trim()) return;
    try {
      await mutate(comment.slug, api =>
        api.editMessage(comment.id, message.id, { body: editing.trim() })
      );
      setEditing(null);
      setError(null);
    } catch (failure) {
      setError(isReviewApiError(failure) ? failure.message : String(failure));
    }
  };
  if (editing !== null) {
    return (
      <div className="mt-2 flex flex-col gap-2">
        <Textarea
          value={editing}
          autoFocus
          aria-label={t("thread.editMessage")}
          onChange={event => setEditing(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void save();
            if (event.key === "Escape") {
              event.stopPropagation();
              setEditing(null);
            }
          }}
          className="min-h-16 resize-none text-[13px]"
        />
        {error && (
          <p role="alert" className="text-[11px] text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="xs" onClick={() => setEditing(null)}>
            {t("common.cancel")}
          </Button>
          <Button size="xs" onClick={() => void save()}>
            {t("thread.save")}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <>
      <p className="mt-2 text-[13px] leading-relaxed whitespace-pre-wrap text-foreground/90">
        {message.body}
        {message.editedAt && (
          <span className="ml-1 text-[11px] text-muted-foreground">({t("thread.edited")})</span>
        )}
      </p>
      {own && (
        <button
          type="button"
          onClick={() => setEditing(message.body)}
          className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <Pencil className="size-3" />
          {t("thread.edit")}
        </button>
      )}
      <Images comment={comment} message={message} />
    </>
  );
}

function Source({ comment }: { comment: ReviewComment }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (comment.target.kind === "node" || !comment.target.source) return null;
  const chain = comment.target.sourceChain;
  return (
    <div className="mt-2">
      <button
        type="button"
        title={comment.target.source}
        aria-expanded={chain.length > 1 ? open : undefined}
        onClick={() => setOpen(value => !value)}
        className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground hover:text-foreground"
      >
        <Code className="size-3 shrink-0" />
        <span className="truncate">{shortSource(comment.target.source)}</span>
        {chain.length > 1 && <span className="shrink-0">+{chain.length - 1}</span>}
      </button>
      {open && chain.length > 0 && (
        <ol
          aria-label={t("thread.sourceChain")}
          className="mt-1.5 flex flex-col gap-0.5 rounded-md border border-border bg-[var(--shell-panel)] p-2 font-mono text-[10.5px] text-muted-foreground"
        >
          {chain.map(entry => (
            <li key={entry} className="truncate" title={entry}>
              {entry}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function ThreadCard({
  comment,
  active,
  onFocus,
}: {
  comment: ReviewComment;
  active: boolean;
  onFocus: () => void;
}) {
  const t = useT();
  const review = useReviewData();
  const mutate = useReviewMutation();
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [first, ...replies] = comment.thread;
  const permissions = review?.permissions;
  const run = async (task: () => Promise<unknown>) => {
    setError(null);
    try {
      await task();
    } catch (failure) {
      setError(isReviewApiError(failure) ? failure.message : String(failure));
      throw failure;
    }
  };
  if (!first) return null;
  return (
    <article
      aria-label={t("thread.label", { number: commentNumber(comment) })}
      aria-current={active ? "true" : undefined}
      onClick={() => {
        if (!active) onFocus();
      }}
      className={cn(
        "rounded-xl border border-border bg-background p-3",
        !active && "cursor-pointer hover:border-primary/40",
        active && "border-primary/60 shadow-[0_0_0_3px_var(--shell-primary-soft)]"
      )}
    >
      <header className="flex items-center gap-2">
        <CommentNumber comment={comment} />
        <Author message={first} />
        <Time at={first.at} />
      </header>
      <MessageBody comment={comment} message={first} />
      <Source comment={comment} />
      {replies.map(reply => (
        <div key={reply.id} className="mt-3 border-l-2 border-primary/40 pl-3">
          <div className="flex items-center gap-2">
            <CornerDownRight className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Author message={reply} />
            <Time at={reply.at} />
          </div>
          <MessageBody comment={comment} message={reply} />
        </div>
      ))}
      {!active && (
        <button
          type="button"
          onClick={onFocus}
          className="sr-only focus:not-sr-only focus:mt-2 focus:text-xs"
        >
          {t("thread.openThread")}
        </button>
      )}
      {active && permissions?.comment && (
        <div className="mt-3 flex flex-col gap-2" onClick={event => event.stopPropagation()}>
          {comment.status === "open" ? (
            resolving ? (
              <Composer
                reviewKey={comment.slug}
                submitLabel={t("thread.resolve")}
                placeholder={t("thread.resolveNote")}
                draftScope={`resolve:${comment.id}`}
                autoFocus
                onCancel={() => setResolving(false)}
                onSubmit={input =>
                  run(() =>
                    mutate(comment.slug, api =>
                      api.setStatus(comment.id, "resolved", {
                        body: input.body,
                        attachments: input.attachments,
                      })
                    )
                  ).then(() => setResolving(false))
                }
              />
            ) : (
              <>
                <Composer
                  reviewKey={comment.slug}
                  submitLabel={t("thread.reply")}
                  placeholder={t("thread.replyPlaceholder")}
                  draftScope={`reply:${comment.id}`}
                  onSubmit={input =>
                    run(() => mutate(comment.slug, api => api.reply(comment.id, input)))
                  }
                />
                <div className="flex items-center gap-1">
                  {permissions.delete && <DeleteButton comment={comment} onError={setError} />}
                  <Button
                    variant="outline"
                    size="xs"
                    className="ml-auto"
                    onClick={() =>
                      void run(() =>
                        mutate(comment.slug, api => api.setStatus(comment.id, "resolved"))
                      )
                    }
                  >
                    <CircleCheck data-icon="inline-start" />
                    {t("thread.resolve")}
                  </Button>
                  <Button variant="ghost" size="xs" onClick={() => setResolving(true)}>
                    {t("thread.resolveWithNote")}
                  </Button>
                </div>
              </>
            )
          ) : (
            <div className="flex items-center gap-1">
              {permissions.delete && <DeleteButton comment={comment} onError={setError} />}
              <Button
                variant="outline"
                size="xs"
                className="ml-auto"
                onClick={() =>
                  void run(() => mutate(comment.slug, api => api.setStatus(comment.id, "open")))
                }
              >
                <RotateCcw data-icon="inline-start" />
                {t("thread.reopen")}
              </Button>
            </div>
          )}
          {error && (
            <p role="alert" className="text-[11px] text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

function DeleteButton({
  comment,
  onError,
}: {
  comment: ReviewComment;
  onError: (message: string) => void;
}) {
  const t = useT();
  const mutate = useReviewMutation();
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <Button
          variant="destructive"
          size="xs"
          onClick={() =>
            void mutate(comment.slug, api => api.deleteComment(comment.id)).catch(
              (failure: unknown) =>
                onError(isReviewApiError(failure) ? failure.message : String(failure))
            )
          }
        >
          {t("thread.confirmDelete")}
        </Button>
        <Button variant="ghost" size="xs" onClick={() => setConfirming(false)}>
          {t("common.cancel")}
        </Button>
      </span>
    );
  }
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={t("thread.delete", { number: commentNumber(comment) })}
      className="text-muted-foreground hover:text-destructive"
      onClick={() => setConfirming(true)}
    >
      <Trash2 />
    </Button>
  );
}
