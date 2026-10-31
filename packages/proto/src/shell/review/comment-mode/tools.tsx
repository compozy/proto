/**
 * Canvas tools of comment mode. Screen view: Select and Comment (`C` starts a keyboard pick).
 * Flow canvas: a comment on the selected step, or on the whole flow without a selection
 * (US-017; node targets, key `flow-<id>`). Absent when the build cannot write reviews.
 */
import { useEffect, useEffectEvent, useState } from "react";

import type { ReviewTarget } from "../../app/slots";
import { useT } from "../../lib/i18n";
import { useLocation } from "../../lib/navigation";
import { nodeTitle } from "../../lib/registry-model";
import { useRegistry } from "../../lib/shell-data";
import { useShortcuts } from "../../lib/shortcuts";
import { useResolvedTheme } from "../../lib/theme";
import { Button } from "../../ui/button";
import { cn } from "../../ui/utils";
import { useReviewData, useReviewMutation } from "../data";
import { Composer } from "./composer";
import { MessageSquarePlus, MousePointer2 } from "./icons";
import { useCommentMode } from "./state";

export function CommentTools({ target }: { target: ReviewTarget }) {
  const review = useReviewData();
  if (!review?.writable) return null;
  return target.kind === "prototype" ? (
    <ScreenTools reviewKey={target.key} />
  ) : (
    <FlowTool target={target} />
  );
}

const group =
  "flex items-center gap-0.5 rounded-xl border border-border bg-[var(--shell-panel)] p-1";
const active = "bg-[var(--shell-primary-soft)] text-primary";

function ScreenTools({ reviewKey }: { reviewKey: string }) {
  const t = useT();
  const mode = useCommentMode();
  const commenting = mode.tool === "comment";

  // Another prototype is another review: leave comment mode.
  const reset = useEffectEvent(() => mode.setTool("select"));
  useEffect(() => () => reset(), [reviewKey]);

  useShortcuts({
    c: () => (commenting ? mode.setTool("select") : mode.setTool("comment", { keyboard: true })),
  });

  return (
    <div role="toolbar" aria-label={t("comment.tools")} className={group}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("comment.select")}
        aria-pressed={!commenting}
        className={cn(!commenting && active)}
        onClick={() => mode.setTool("select")}
      >
        <MousePointer2 />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("comment.tool")}
        aria-pressed={commenting}
        data-testid="comment-tool"
        className={cn(commenting && active)}
        onClick={() => mode.setTool(commenting ? "select" : "comment")}
      >
        <MessageSquarePlus />
      </Button>
    </div>
  );
}

function FlowTool({ target }: { target: Extract<ReviewTarget, { kind: "flow" }> }) {
  const t = useT();
  const mode = useCommentMode();
  const mutate = useReviewMutation();
  const registry = useRegistry();
  const location = useLocation();
  const theme = useResolvedTheme(location.theme);
  const [open, setOpen] = useState(false);
  const flow = registry.flows.find(item => item.id === target.flow);
  const node = flow?.nodes.find(item => item.id === target.node) ?? null;
  const label = node ? nodeTitle(node) : t("comment.wholeFlow");

  useShortcuts({ c: () => setOpen(value => !value) });

  const submit = async (input: { body: string; attachments: string[] }) => {
    const created = await mutate(target.key, api =>
      api.addComment(target.key, {
        body: input.body,
        attachments: input.attachments,
        target: { kind: "node", node: node?.id ?? null, label: node ? label : "" },
        context: {
          state: node?.id ?? "",
          theme,
          role: null,
          viewport: { width: window.innerWidth, height: window.innerHeight },
        },
      })
    );
    setOpen(false);
    mode.focusComment(created.id);
  };

  return (
    <div className="relative">
      <div role="toolbar" aria-label={t("comment.tools")} className={group}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("comment.tool")}
          aria-pressed={open}
          aria-expanded={open}
          data-testid="comment-tool"
          className={cn(open && active)}
          onClick={() => setOpen(value => !value)}
        >
          <MessageSquarePlus />
        </Button>
      </div>
      {open && (
        <div
          role="dialog"
          aria-label={node ? t("comment.step", { step: node.step, label }) : t("comment.flow")}
          className="absolute top-full right-0 z-30 mt-2 w-[300px] rounded-xl border border-border bg-[var(--shell-panel)] p-3 shadow-2xl"
        >
          <Composer
            key={`${target.key}:${node?.id ?? ""}`}
            reviewKey={target.key}
            submitLabel={t("comment.send")}
            autoFocus
            onCancel={() => setOpen(false)}
            onSubmit={submit}
            header={
              <p className="text-[13px] font-medium">
                {node ? t("comment.step", { step: node.step, label }) : t("comment.flow")}
              </p>
            }
          />
        </div>
      )}
    </div>
  );
}
