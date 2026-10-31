/**
 * The review slice plugged into the browsing shell: the slots (top bar actions, status, More
 * menu, Comments inspector tab) and the small review signals other surfaces render directly
 * (per-state counts, step badges, spec status, the Comments rail item, ⌘K comment results).
 * Every piece renders nothing when the build has no review data.
 */
import type { ReactNode } from "react";

import type { RegistryState, ResolvedNode } from "../../model/registry";
import { flowKey, flowOfKey } from "../../model/registry";
import { Link } from "../app/link";
import type { ReviewTarget, ShellSlots } from "../app/slots";
import { useLocale, useT, type Translate } from "../lib/i18n";
import { go, useLocation } from "../lib/navigation";
import type { SearchItem } from "../lib/search";
import { useRegistry } from "../lib/shell-data";
import { Bot, MessageSquare } from "../ui/icons";
import { cn } from "../ui/utils";
import { ReviewActions, ReviewMenu, ReviewStatus, StatusPill } from "./approval/approval";
import { useAllComments, useReviewData, useReviewState, useReviewStates } from "./data";
import { byActivity, commentNode, commentNumber, isWaiting, relativeTime } from "./format";
import { commentView } from "./inbox/inbox";
import { ThreadsPanel, useThreadFocus } from "./threads/threads-panel";

/** Slots of the review slice; merge comment mode's (`canvasTools`, `screenFrame`, …) on top. */
export function reviewSlots(t: Translate): ShellSlots {
  return {
    reviewActions: target => <TopBarActions target={target} />,
    reviewStatus: target => <ReviewStatus reviewKey={target.key} />,
    reviewMenu: target => <ReviewMenu reviewKey={target.key} />,
    inspectorTabs: target => [
      {
        id: "comments",
        label: t("thread.comments"),
        count: <OpenCount reviewKey={target.key} />,
        content:
          target.kind === "prototype" ? (
            <PrototypeThreads target={target} />
          ) : (
            <FlowThreads target={target} />
          ),
      },
    ],
  };
}

/** S21 read-only build without review history: say so where comments would be. */
export function readOnlySlots(t: Translate): ShellSlots {
  return {
    inspectorTabs: () => [
      {
        id: "comments",
        label: t("thread.comments"),
        content: (
          <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-xs text-muted-foreground">
            {t("empty.noReview")}
          </p>
        ),
      },
    ],
  };
}

function TopBarActions({ target }: { target: ReviewTarget | null }) {
  const registry = useRegistry();
  const title =
    target?.kind === "prototype"
      ? (registry.prototypes.find(item => item.slug === target.slug)?.title ?? target.slug)
      : target?.kind === "flow"
        ? (registry.flows.find(item => item.id === target.flow)?.title ?? target.flow)
        : null;
  return <ReviewActions reviewKey={target?.key ?? null} title={title} />;
}

/** Open comments of a key as the inspector tab pill. */
function OpenCount({ reviewKey }: { reviewKey: string }) {
  const state = useReviewState(reviewKey).data;
  if (!state) return null;
  return (
    <span className="rounded-full bg-[var(--shell-primary-soft)] px-1.5 font-mono text-[10px] text-[var(--shell-primary-text)]">
      {state.open}
    </span>
  );
}

function PrototypeThreads({ target }: { target: Extract<ReviewTarget, { kind: "prototype" }> }) {
  const { view } = useLocation();
  const comment = view.area === "screen" ? view.comment : null;
  const focus = useThreadFocus({
    focused: comment,
    focus: id => {
      if (view.area === "screen") go({ ...view, comment: id }, { replace: true });
    },
  });
  return (
    <ThreadsPanel
      reviewKey={target.key}
      scope={{ kind: "state", state: target.state }}
      focused={focus.focused}
      onFocus={focus.focus}
    />
  );
}

function FlowThreads({ target }: { target: Extract<ReviewTarget, { kind: "flow" }> }) {
  const { view } = useLocation();
  const focus = useThreadFocus({
    focused: view.area === "flow" ? (view.comment ?? null) : null,
    focus: id => {
      if (view.area === "flow") go({ ...view, comment: id }, { replace: true });
    },
  });
  return (
    <ThreadsPanel
      reviewKey={target.key}
      scope={{ kind: "step", node: target.node }}
      focused={focus.focused}
      onFocus={focus.focus}
    />
  );
}

/** Open comments per state in the state picker (`StatePicker.annotate`). */
export function useStateAnnotation(slug: string) {
  const comments = useAllComments().data;
  return (state: RegistryState): ReactNode => {
    const count =
      comments?.filter(
        item => item.slug === slug && item.status === "open" && item.context.state === state.id
      ).length ?? 0;
    if (!count) return null;
    return <CountChip count={count} />;
  };
}

/** Open comments of a flow step (step card badge). */
export function useStepBadge(flow: string) {
  const comments = useAllComments().data;
  const key = flowKey(flow);
  return (node: ResolvedNode): ReactNode => {
    const count =
      comments?.filter(
        item => item.slug === key && item.status === "open" && commentNode(item) === node.id
      ).length ?? 0;
    return count ? <CountChip count={count} solid /> : null;
  };
}

function CountChip({ count, solid = false }: { count: number; solid?: boolean }) {
  const t = useT();
  return (
    <span
      aria-label={t("approval.open", { count })}
      className={cn(
        "flex shrink-0 items-center gap-1 font-mono text-[10px]",
        solid
          ? "h-5 rounded-full bg-primary px-1.5 font-semibold text-primary-foreground"
          : "text-primary"
      )}
    >
      <MessageSquare className={solid ? "size-2.5" : "size-3"} aria-hidden="true" />
      {count}
    </span>
  );
}

/** Review status of a group of keys (a spec card): approved when every key is approved. */
export function KeysStatus({ keys }: { keys: string[] }) {
  const review = useReviewData();
  if (!review || !keys.length) return null;
  return <KeysStatusInner keys={keys} />;
}

function KeysStatusInner({ keys }: { keys: string[] }) {
  const comments = useAllComments().data;
  const states = useReviewStates(keys).data;
  if (!comments || !states) return null;
  const approved = states.every(state => state.status === "approved");
  const set = new Set(keys);
  const open = comments.filter(item => item.status === "open" && set.has(item.slug)).length;
  return <StatusPill open={open} approved={approved && open === 0} />;
}

/** The Comments rail item, with a dot while threads wait for the reviewer. */
export function CommentsRailItem({
  active,
  className,
  activeClassName,
}: {
  active: boolean;
  className: string;
  activeClassName: string;
}) {
  const t = useT();
  const review = useReviewData();
  const comments = useAllComments().data;
  if (!review) return null;
  const waiting = comments?.some(isWaiting) ?? false;
  return (
    <Link
      to={{ area: "comments", filter: waiting ? "waiting" : "open" }}
      aria-label={waiting ? t("rail.commentsWaiting") : t("rail.comments")}
      title={t("rail.comments")}
      aria-current={active ? "page" : undefined}
      className={cn(className, active && activeClassName)}
    >
      <MessageSquare className="size-4" />
      {waiting && (
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary"
        />
      )}
    </Link>
  );
}

/** ⌘K results for comments (`text` tier: after slugs, titles and state labels). */
export function useCommentSearchItems(): SearchItem[] {
  const t = useT();
  const registry = useRegistry();
  const comments = useAllComments().data ?? [];
  return comments.map(comment => {
    const first = comment.thread[0];
    const flow = flowOfKey(comment.slug);
    return {
      id: `c:${comment.id}`,
      group: "comments" as const,
      label: `#${commentNumber(comment)} ${first?.body ?? ""}`,
      detail: flow ? `${t("rail.flows")} · ${flow}` : comment.slug,
      hint: comment.status === "resolved" ? t("thread.resolved") : undefined,
      text: comment.thread.map(message => message.body).join("\n"),
      target: { view: commentView(registry, comment) },
    };
  });
}

/** "Updated …" on a spec card: the latest comment or review change of its keys. */
export function KeysUpdated({ keys }: { keys: string[] }) {
  const review = useReviewData();
  if (!review || !keys.length) return null;
  return <KeysUpdatedInner keys={keys} />;
}

function KeysUpdatedInner({ keys }: { keys: string[] }) {
  const t = useT();
  const locale = useLocale();
  const comments = useAllComments().data;
  const states = useReviewStates(keys).data;
  const set = new Set(keys);
  const times = [
    ...(comments ?? []).filter(item => set.has(item.slug)).map(item => item.updatedAt),
    ...(states ?? []).flatMap(state => (state.updatedAt ? [state.updatedAt] : [])),
  ];
  if (!times.length) return null;
  const latest = times.reduce((a, b) => (Date.parse(a) > Date.parse(b) ? a : b));
  return (
    <p className="mt-3 text-[11px] text-muted-foreground">
      {t("overview.updated", { when: relativeTime(latest, locale) })}
    </p>
  );
}

/**
 * S2 "Needs review": open threads across the app, newest first, each saying whether an agent
 * replied (waiting for you) or nobody did yet; a thread opens in context.
 */
export function NeedsReview() {
  const t = useT();
  const locale = useLocale();
  const review = useReviewData();
  const registry = useRegistry();
  const comments = useAllComments().data;
  if (!review || !comments) return null;
  const open = comments.filter(item => item.status === "open").sort(byActivity);
  return (
    <aside
      aria-label={t("overview.needsReview")}
      className="hidden w-[300px] shrink-0 flex-col border-l border-border bg-[var(--shell-panel)] lg:flex xl:w-[340px]"
    >
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h2 className="text-[15px] font-semibold tracking-tight">{t("overview.needsReview")}</h2>
        <span className="font-mono text-[11px] text-muted-foreground">
          {t("approval.open", { count: open.length })}
        </span>
      </div>
      <ul className="flex min-h-0 flex-col gap-2 overflow-y-auto px-5 pb-5">
        {open.length === 0 && <li className="text-xs text-muted-foreground">{t("inbox.empty")}</li>}
        {open.slice(0, 50).map(comment => {
          const first = comment.thread[0];
          const replies = comment.thread.length - 1;
          return (
            <li key={comment.id}>
              <Link
                to={commentView(registry, comment)}
                className="block rounded-xl border border-border bg-background p-3 hover:border-primary/50"
              >
                <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="grid size-4.5 shrink-0 place-items-center rounded-full bg-primary font-mono text-[9px] font-semibold text-primary-foreground">
                    {commentNumber(comment)}
                  </span>
                  <span className="truncate font-mono">
                    {comment.slug} · {comment.context.state || "—"}
                  </span>
                  <span className="ml-auto shrink-0">
                    {relativeTime(comment.updatedAt, locale)}
                  </span>
                </span>
                <span className="mt-2 line-clamp-2 block text-[13px] leading-relaxed">
                  {first?.body}
                </span>
                <span
                  className={cn(
                    "mt-2 flex items-center gap-1.5 text-[11px]",
                    isWaiting(comment)
                      ? "text-[var(--shell-primary-text)]"
                      : "text-muted-foreground"
                  )}
                >
                  {isWaiting(comment) ? (
                    <Bot className="size-3" />
                  ) : (
                    <MessageSquare className="size-3" />
                  )}
                  {isWaiting(comment)
                    ? t("overview.waiting")
                    : replies
                      ? t("overview.replies", { count: replies })
                      : t("overview.noReplies")}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
