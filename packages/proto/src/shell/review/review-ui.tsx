/**
 * The review slice plugged into the browsing shell: the slots (top bar actions, status, More
 * menu, Comments inspector tab) and the small review signals other surfaces render directly
 * (per-state counts, step badges, spec status, the Comments rail item, ⌘K comment results).
 * Every piece renders nothing when the build has no review data.
 */
import { useState, type ReactNode } from "react";

import type { RegistryState, ResolvedNode } from "../../model/registry";
import { flowKey, flowOfKey } from "../../model/registry";
import { Link } from "../app/link";
import type { ReviewTarget, ShellSlots } from "../app/slots";
import { useT, type Translate } from "../lib/i18n";
import { go, useLocation } from "../lib/navigation";
import type { SearchItem } from "../lib/search";
import { useRegistry } from "../lib/shell-data";
import { MessageSquare } from "../ui/icons";
import { cn } from "../ui/utils";
import { ReviewActions, ReviewMenu, ReviewStatus, StatusPill } from "./approval/approval";
import { useAllComments, useReviewData, useReviewState, useReviewStates } from "./data";
import { commentNode, commentNumber, isWaiting } from "./format";
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
  const [focused, setFocused] = useState<string | null>(null);
  const focus = useThreadFocus({ focused, focus: setFocused });
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
