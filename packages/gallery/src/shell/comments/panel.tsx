/**
 * Comments of the open prototype or flow: open/resolved filter, this state (step) or all of them,
 * threads with replies, resolve/reopen and delete (with confirmation). Selecting a comment jumps
 * the canvas to the state, theme and width it was written on, or to its flow step. On a flow the
 * panel also writes new comments (`composer`); a prototype writes them on the canvas.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CheckIcon, RotateCcwIcon, Trash2Icon, XIcon } from "@proto/ui/lib/icons";

import { Button } from "@proto/ui/components/button";
import { Textarea } from "@proto/ui/components/textarea";
import { cn } from "@proto/ui/lib/utils";

import { AttachmentInput } from "./attachments";
import { Message } from "./message";
import { commentsApi, useCommentsFailure } from "./api";
import type { ReviewComment } from "./model";
import { commentNumber, targetSummary } from "./model";
import { useAttachments } from "./use-attachments";

type Place = { id: string; label: string };

type PanelProps = {
  slug: string;
  /** What the comments sit on: a prototype's states or a flow's steps. */
  kind: "prototype" | "flow";
  comments: ReviewComment[];
  places: readonly Place[];
  /** The state (or selected step, "" for none) on screen. */
  place: string;
  selectedId: string | null;
  onSelect: (comment: ReviewComment | null) => void;
  onClose: () => void;
  composer?: ReactNode;
  /** Title and close button; off when a host (the flow side panel) provides its own. */
  heading?: boolean;
  className?: string;
};

const scopes = {
  prototype: { here: "This state", all: "All states" },
  flow: { here: "This step", all: "Whole flow" },
};

function Toggle<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-lg bg-muted p-0.5">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className="h-6 flex-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:text-foreground aria-checked:bg-card aria-checked:font-medium aria-checked:text-foreground"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function CommentsPanel(props: PanelProps) {
  const { comments, place, selectedId } = props;
  const [status, setStatus] = useState<"open" | "resolved">("open");
  // A flow without a selected step lists every comment.
  const [scope, setScope] = useState<"state" | "all">(props.kind === "flow" ? "all" : "state");
  const failure = useCommentsFailure();
  // The selected comment (pin click or link) always shows, whatever the filters.
  const shown = comments.filter(
    comment =>
      comment.id === selectedId ||
      (comment.status === status && (scope === "all" || comment.context.state === place))
  );
  const open = comments.filter(comment => comment.status === "open").length;
  const labelOf = (id: string) =>
    props.places.find(option => option.id === id)?.label ?? (id || "Whole flow");

  return (
    <aside
      className={cn(
        "flex h-full w-full flex-col gap-3 overflow-hidden rounded-[20px] bg-card p-3",
        props.className
      )}
      aria-label="Comments"
      data-testid="comments-panel"
    >
      {props.heading === false ? null : (
        <div className="flex items-center gap-2 px-1 pt-1">
          <h2 className="text-[15px] font-medium">Comments</h2>
          <span className="font-mono text-xs text-muted-foreground">{open} open</span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto"
            onClick={props.onClose}
            aria-label="Close comments"
          >
            <XIcon />
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Toggle
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "open", label: "Open" },
            { value: "resolved", label: "Resolved" },
          ]}
        />
        <Toggle
          label={props.kind === "flow" ? "Steps" : "States"}
          value={scope}
          onChange={setScope}
          options={[
            { value: "state", label: scopes[props.kind].here },
            { value: "all", label: scopes[props.kind].all },
          ]}
        />
      </div>
      {props.composer}
      {failure ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          Comments API unavailable ({failure}). Is `bun run proto dev` running?
        </p>
      ) : null}
      <ol className="-mx-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1 pb-1">
        {shown.length === 0 ? (
          <li className="px-1 py-6 text-center text-sm text-muted-foreground">
            {status === "resolved"
              ? "No resolved comments."
              : props.kind === "flow"
                ? "Nothing open here. Write above about the selected step or the whole flow."
                : "Nothing open here. Use comment mode (C) to mark a point on the screen."}
          </li>
        ) : null}
        {shown.map(comment => (
          <CommentCard
            key={comment.id}
            comment={comment}
            stateLabel={labelOf(comment.context.state)}
            selected={comment.id === selectedId}
            onSelect={() => props.onSelect(comment.id === selectedId ? null : comment)}
          />
        ))}
      </ol>
    </aside>
  );
}

function CommentCard({
  comment,
  stateLabel,
  selected,
  onSelect,
}: {
  comment: ReviewComment;
  stateLabel: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const { context, target } = comment;

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  return (
    <li
      ref={ref}
      className={cn(
        "flex flex-col gap-2 rounded-xl p-3 transition-colors",
        selected ? "bg-accent" : "bg-muted/60 hover:bg-muted"
      )}
      data-testid="comment-card"
    >
      <button type="button" onClick={onSelect} className="flex flex-col gap-1 text-left">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "grid size-5 shrink-0 place-items-center rounded-full font-mono text-[10px] tabular-nums",
              comment.status === "open"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            {commentNumber(comment)}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {stateLabel}
          </span>
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
            {context.theme ?? "system"}
            {target.kind === "node" ? "" : ` · ${context.viewport.width}`}
            {context.role ? ` · ${context.role}` : ""}
          </span>
        </span>
        {/* A step comment is already named by its step label above. */}
        {target.kind === "node" ? null : (
          <span className="truncate text-xs text-muted-foreground">{targetSummary(target)}</span>
        )}
        {target.kind !== "node" && target.source ? (
          <span
            className="truncate font-mono text-[11px] text-muted-foreground"
            title={target.source ?? undefined}
          >
            {target.source}
          </span>
        ) : null}
      </button>
      <ul className="flex flex-col gap-2 border-t border-foreground/7 pt-2">
        {comment.thread.map(message => (
          <li key={message.id}>
            <Message slug={comment.slug} commentId={comment.id} message={message} />
          </li>
        ))}
      </ul>
      {selected ? <CommentActions comment={comment} /> : null}
    </li>
  );
}

function CommentActions({ comment }: { comment: ReviewComment }) {
  const uploads = useAttachments(comment.slug);
  const [reply, setReply] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const run = async (action: () => Promise<unknown>) => {
    setPending(true);
    await action()
      .then(() => setReply(""))
      .catch(() => undefined) // The shared comments store displays the request failure.
      .finally(() => setPending(false));
  };

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={event => {
        event.preventDefault();
        if (reply.trim() && uploads.ready)
          void run(() =>
            commentsApi
              .reply(comment.slug, comment.id, reply, uploads.ids)
              .then(() => uploads.committed())
          );
      }}
    >
      <Textarea
        value={reply}
        onChange={event => setReply(event.target.value)}
        onPaste={event => {
          if (event.clipboardData.files.length) {
            event.preventDefault();
            uploads.add([...event.clipboardData.files]);
          }
        }}
        placeholder="Reply…"
        aria-label="Reply"
        className="min-h-14 text-sm"
      />
      <AttachmentInput uploads={uploads} disabled={pending} />
      <div className="flex flex-wrap items-center gap-1.5">
        <Button type="submit" size="sm" disabled={!reply.trim() || pending || !uploads.ready}>
          Reply
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            void run(() =>
              commentsApi.setStatus(
                comment.slug,
                comment.id,
                comment.status === "open" ? "resolved" : "open"
              )
            )
          }
        >
          {comment.status === "open" ? <CheckIcon /> : <RotateCcwIcon />}
          {comment.status === "open" ? "Resolve" : "Reopen"}
        </Button>
        {confirming ? (
          <span className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => void run(() => commentsApi.remove(comment.slug, comment.id))}
            >
              Delete
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Keep
            </Button>
          </span>
        ) : (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="ml-auto"
            onClick={() => setConfirming(true)}
            aria-label="Delete comment"
          >
            <Trash2Icon />
          </Button>
        )}
      </div>
    </form>
  );
}
