/**
 * S10 approval and the review signals of S1: the status pill (pink while in review, green once
 * approved), the open-count pill, Approve with the open-comment confirmation (`confirmOpen`),
 * "Approved by <name> · <commit>" and Reopen in the More menu. Absent for principals who may
 * not approve (agents, `comment`-only sessions) and in read-only builds.
 */
import { useState } from "react";

import type { ReviewEvent } from "../../../model/review";
import { ShellModal } from "../../app/chrome";
import { useT } from "../../lib/i18n";
import { useShellData } from "../../lib/shell-data";
import { Button } from "../../ui/button";
import { Check, Ellipsis, RotateCcw, TriangleAlert } from "../../ui/icons";
import { cn } from "../../ui/utils";
import { isReviewApiError } from "../api";
import { useAllComments, useReviewData, useReviewMutation, useReviewState } from "../data";

/** The last approval event, for "Approved by … · commit". */
export function lastApproval(events: readonly ReviewEvent[]) {
  return events.findLast(event => event.type === "approved") ?? null;
}

export function StatusPill({ open, approved }: { open: number; approved: boolean }) {
  const t = useT();
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium whitespace-nowrap",
        approved
          ? "bg-[color-mix(in_oklch,var(--tone-end)_16%,transparent)] text-[var(--tone-end)]"
          : "bg-[var(--shell-primary-soft)] text-[var(--shell-primary-text)]"
      )}
    >
      {approved ? (
        t("approval.approved")
      ) : (
        <>
          <span className="max-xl:hidden">{t("approval.inReview")} ·</span>
          {t("approval.open", { count: open })}
        </>
      )}
    </span>
  );
}

/** Sub-header status of a key: the pill and, once approved, who approved it at which commit. */
export function ReviewStatus({ reviewKey }: { reviewKey: string }) {
  const t = useT();
  const state = useReviewState(reviewKey).data;
  if (!state) return null;
  const approved = state.status === "approved";
  const event = approved ? lastApproval(state.events) : null;
  return (
    <>
      <StatusPill open={state.open} approved={approved} />
      {event && (
        <span className="hidden min-w-0 truncate text-xs whitespace-nowrap text-muted-foreground xl:inline">
          {[
            event.authorName ? t("approval.by", { name: event.authorName }) : null,
            event.commit?.slice(0, 7),
            event.openCount ? t("approval.recorded", { count: event.openCount }) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      )}
    </>
  );
}

/** Top bar: the open count of the item on screen (or of the app) and Approve / Approved. */
export function ReviewActions({
  reviewKey,
  title,
}: {
  reviewKey: string | null;
  title: string | null;
}) {
  const review = useReviewData();
  if (!review) return null;
  return (
    <>
      {reviewKey ? <KeyOpenPill reviewKey={reviewKey} /> : <AppOpenPill />}
      {reviewKey && title && review.permissions.approve && (
        <Approve reviewKey={reviewKey} title={title} />
      )}
    </>
  );
}

function OpenPill({ open }: { open: number }) {
  const t = useT();
  return (
    <span className="hidden h-8 items-center gap-1.5 rounded-full border border-border px-3 text-[13px] tabular-nums md:flex">
      <span
        className={cn("size-1.5 rounded-full", open ? "bg-primary" : "bg-muted-foreground/40")}
      />
      {t("approval.open", { count: open })}
    </span>
  );
}

function KeyOpenPill({ reviewKey }: { reviewKey: string }) {
  const state = useReviewState(reviewKey).data;
  return state ? <OpenPill open={state.open} /> : null;
}

function AppOpenPill() {
  const comments = useAllComments().data;
  return comments ? (
    <OpenPill open={comments.filter(item => item.status === "open").length} />
  ) : null;
}

function Approve({ reviewKey, title }: { reviewKey: string; title: string }) {
  const t = useT();
  const state = useReviewState(reviewKey).data;
  const mutate = useReviewMutation();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!state) return null;
  if (state.status === "approved") {
    return (
      <span className="flex h-8 items-center gap-1.5 rounded-full bg-[color-mix(in_oklch,var(--tone-end)_16%,transparent)] px-3.5 text-[13px] font-semibold text-[var(--tone-end)]">
        <Check className="size-3.5" />
        {t("approval.approved")}
      </span>
    );
  }
  const approve = async (confirmOpen: boolean) => {
    setError(null);
    try {
      await mutate(reviewKey, api => api.transition(reviewKey, "approved", { confirmOpen }));
      setConfirming(false);
    } catch (failure) {
      // Someone added a comment meanwhile: confirm with the fresh count.
      if (isReviewApiError(failure, "review_has_open_comments")) setConfirming(true);
      else setError(isReviewApiError(failure) ? failure.message : String(failure));
    }
  };
  return (
    <>
      <Button
        className="h-8 rounded-full px-3.5 font-semibold"
        onClick={() => (state.open > 0 ? setConfirming(true) : void approve(false))}
      >
        <Check data-icon="inline-start" />
        {t("approval.approve")}
      </Button>
      {error && !confirming && (
        <span role="alert" className="sr-only">
          {error}
        </span>
      )}
      {confirming && (
        <ApproveDialog
          title={title}
          reviewKey={reviewKey}
          open={state.open}
          error={error}
          onCancel={() => setConfirming(false)}
          onConfirm={() => void approve(true)}
        />
      )}
    </>
  );
}

function ApproveDialog({
  title,
  reviewKey,
  open,
  error,
  onCancel,
  onConfirm,
}: {
  title: string;
  reviewKey: string;
  open: number;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useT();
  const { bootstrap } = useShellData();
  return (
    <ShellModal label={t("approval.dialogTitle", { title })} onClose={onCancel}>
      <div className="p-6">
        <span className="grid size-10 place-items-center rounded-xl bg-[var(--shell-primary-soft)] text-primary">
          <Check className="size-5" />
        </span>
        <h2 className="mt-4 text-[17px] font-semibold tracking-tight">
          {t("approval.dialogTitle", { title })}
        </h2>
        <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-[color-mix(in_oklch,var(--tone-warning)_12%,transparent)] p-3 text-[13px]">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[var(--tone-warning)]" />
          <span className="min-w-0">
            <b className="font-semibold">{t("approval.stillOpen", { count: open })}</b>{" "}
            {t("approval.stillOpenNote")}
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-[88px_1fr] gap-y-1.5 text-[13px]">
          <dt className="text-muted-foreground">{t("approval.key")}</dt>
          <dd className="font-mono text-xs">{reviewKey}</dd>
          {bootstrap.commit && (
            <>
              <dt className="text-muted-foreground">{t("approval.commit")}</dt>
              <dd className="font-mono text-xs">{bootstrap.commit.slice(0, 7)}</dd>
            </>
          )}
        </dl>
        {error && (
          <p role="alert" className="mt-3 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-border p-4">
        <Button variant="outline" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button className="font-semibold" onClick={onConfirm}>
          <Check data-icon="inline-start" />
          {t("approval.approveAnyway")}
        </Button>
      </div>
    </ShellModal>
  );
}

/**
 * Sub-header More menu: Reopen an approved review. A small disclosure menu (one action; a full
 * menu primitive would cost the shell bundle more than it gives).
 */
export function ReviewMenu({ reviewKey }: { reviewKey: string }) {
  const t = useT();
  const review = useReviewData();
  const state = useReviewState(reviewKey).data;
  const mutate = useReviewMutation();
  const [open, setOpen] = useState(false);
  if (!review?.permissions.approve || state?.status !== "approved") return null;
  return (
    <div
      className="relative"
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={event => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("approval.more")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <Ellipsis />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-40 mt-1 min-w-44 rounded-lg border border-border bg-[var(--shell-panel)] p-1 shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            autoFocus
            onClick={() => {
              setOpen(false);
              void mutate(reviewKey, api => api.transition(reviewKey, "in_review"));
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-foreground hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
          >
            <RotateCcw className="size-4" />
            {t("approval.reopen")}
          </button>
        </div>
      )}
    </div>
  );
}
