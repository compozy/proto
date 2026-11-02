/**
 * S9 thread panel (inspector Comments tab): Open / Resolved tabs, scoped to the state on screen
 * (or the selected flow step) or the whole key, the focused thread expanded with its reply
 * composer, and the empty, read-only and "deleted elsewhere" states.
 */
import { useState } from "react";

import type { ReviewComment } from "../../../model/review";
import { useSlots } from "../../app/slots";
import { useT } from "../../lib/i18n";
import { Kbd } from "../../ui/kbd";
import { Tabs, TabsList, TabsTrigger } from "../../ui/tabs";
import { cn } from "../../ui/utils";
import { useComments, useReviewData } from "../data";
import { byActivity, commentNode } from "../format";
import { ReviewHistory } from "../approval/approval";
import { ThreadCard } from "./thread-card";

export type ThreadScope = { kind: "state"; state: string } | { kind: "step"; node: string | null };

function inScope(comment: ReviewComment, scope: ThreadScope) {
  if (scope.kind === "state") return comment.context.state === scope.state;
  return scope.node === null || commentNode(comment) === scope.node;
}

/** Filter one shared key collection by scope/status and reveal the URL-focused thread. */
export function ThreadsPanel({
  reviewKey,
  scope,
  focused,
  onFocus,
}: {
  reviewKey: string;
  scope: ThreadScope;
  focused: string | null;
  onFocus: (id: string | null) => void;
}) {
  const t = useT();
  const review = useReviewData();
  const query = useComments({ key: reviewKey, status: "all" });
  const [tab, setTab] = useState<"open" | "resolved" | null>(null);
  const [all, setAll] = useState(false);
  const comments = (query.data ?? []).filter(item => all || inScope(item, scope)).sort(byActivity);
  const focusedComment = query.data?.find(item => item.id === focused);
  // A focused thread opens its own tab; otherwise the user's choice, Open by default.
  const current = tab ?? (focusedComment?.status === "resolved" ? "resolved" : "open");
  const open = comments.filter(item => item.status === "open");
  const resolved = comments.filter(item => item.status === "resolved");
  const shown = current === "open" ? open : resolved;
  const { canvasTools } = useSlots();
  if (!review) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Tabs value={current} onValueChange={value => setTab(value as "open" | "resolved")}>
          <TabsList className="h-7 rounded-md">
            <TabsTrigger value="open" className="px-2.5 text-xs">
              {t("thread.open")} · {open.length}
            </TabsTrigger>
            <TabsTrigger value="resolved" className="px-2.5 text-xs">
              {t("thread.resolved")} · {resolved.length}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <ScopeToggle scope={scope} all={all} onToggle={() => setAll(value => !value)} />
      </div>
      {focused && query.data && !focusedComment && (
        <p
          role="status"
          className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground"
        >
          {t("thread.deleted", { id: focused })}
        </p>
      )}
      {query.error !== null && !query.data && (
        <p role="alert" className="text-xs text-destructive">
          {t("thread.loadFailed")}
        </p>
      )}
      <div aria-live="polite" className="flex flex-col gap-3">
        {shown.map(comment => (
          <ThreadCard
            key={comment.id}
            comment={comment}
            active={comment.id === focused}
            onFocus={() => onFocus(comment.id)}
          />
        ))}
      </div>
      <ThreadStatus
        writable={review.writable}
        loaded={query.data !== undefined}
        count={shown.length}
        current={current}
        hasTools={Boolean(canvasTools)}
      />
      <ReviewHistory reviewKey={reviewKey} onComment={onFocus} />
    </div>
  );
}

/** Explain loading, read-only and empty-thread states for the current status filter. */
function ThreadStatus({
  writable,
  loaded,
  count,
  current,
  hasTools,
}: {
  writable: boolean;
  loaded: boolean;
  count: number;
  current: "open" | "resolved";
  hasTools: boolean;
}) {
  const t = useT();
  return (
    <>
      {!writable ? (
        <p className="text-center text-xs text-muted-foreground">{t("thread.readOnly")}</p>
      ) : (
        count === 0 &&
        loaded && (
          <div
            className={cn(
              "grid place-items-center rounded-lg border border-dashed border-border px-4 py-5 text-center text-xs text-muted-foreground"
            )}
          >
            {current === "resolved" ? (
              t("thread.noneResolved")
            ) : !hasTools ? (
              t("thread.none")
            ) : (
              <span>
                {t("thread.emptyBefore")} <Kbd className="mx-1 align-middle">C</Kbd>{" "}
                {t("thread.emptyAfter")}
              </span>
            )}
          </div>
        )
      )}
    </>
  );
}

/** Switch between the current state/step and all comments without changing the review key. */
function ScopeToggle({
  scope,
  all,
  onToggle,
}: {
  scope: ThreadScope;
  all: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  const scopeLabel =
    scope.kind === "state"
      ? t("thread.thisState")
      : scope.node
        ? t("thread.thisStep")
        : t("thread.wholeFlow");
  return (
    <>
      {(scope.kind === "state" || scope.node !== null) && (
        <button
          type="button"
          aria-pressed={all}
          onClick={onToggle}
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          {all
            ? scope.kind === "state"
              ? t("thread.allStates")
              : t("thread.wholeFlow")
            : scopeLabel}
        </button>
      )}{" "}
    </>
  );
}
