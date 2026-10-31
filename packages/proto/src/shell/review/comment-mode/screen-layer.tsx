/**
 * Comment mode over the screen frame, in the frame's (scaled) coordinates: it drives the render
 * host's picker over the protocol (`pick:start`/`pick:cancel`, the hover outline is drawn inside
 * the frame), opens the composer beside a picked target, and pins the open comments of the state
 * from `anchors:watch` rects (null → "moved" marker). A `pick:result` counts only during a pick
 * this layer started on this frame, and only with sources inside the app (Safety Invariant 7).
 */
import { useEffect, useEffectEvent, useRef, useState } from "react";

import type { ElementTarget, Rect } from "../../../model/protocol";
import type { ReviewTarget } from "../../app/slots";
import type { FrameGeometry } from "../../frames/screen-frame";
import type { RenderFrameHandle } from "../../frames/use-render-frame";
import { useT } from "../../lib/i18n";
import { useLocation } from "../../lib/navigation";
import { resolveRole } from "../../lib/registry-model";
import { useRegistry } from "../../lib/shell-data";
import { useShortcuts } from "../../lib/shortcuts";
import { useResolvedTheme } from "../../lib/theme";
import { Kbd } from "../../ui/kbd";
import { cn } from "../../ui/utils";
import { useComments, useReviewData, useReviewMutation } from "../data";
import { Composer } from "./composer";
import {
  acceptsPick,
  anchorOf,
  commentNumber,
  composerPosition,
  confinePick,
  nextNumber,
  pinPosition,
  startPick,
  type ActivePick,
  type PickSession,
} from "./pick";
import { onFrameMessage, useCommentMode } from "./state";

type PrototypeTarget = Extract<ReviewTarget, { kind: "prototype" }>;

export function ScreenCommentLayer({
  target,
  frame,
  geometry,
}: {
  target: PrototypeTarget;
  frame: RenderFrameHandle;
  geometry: FrameGeometry;
}) {
  const t = useT();
  const review = useReviewData();
  const mode = useCommentMode();
  const mutate = useReviewMutation();
  const registry = useRegistry();
  const location = useLocation();
  const theme = useResolvedTheme(location.theme);
  const prototype = registry.prototypes.find(item => item.slug === target.slug);
  const requestedRole = location.view.area === "screen" ? location.view.role : null;
  const role = prototype ? resolveRole(registry, prototype, requestedRole) : null;
  const writable = Boolean(review?.writable);

  const open = useComments({ key: target.key, status: "open" }).data ?? [];
  const all = useComments({ key: target.key, status: "all" }).data ?? open;
  const pinned = open.filter(
    comment => comment.context.state === target.state && comment.target.kind !== "node"
  );

  const [rects, setRects] = useState<ReadonlyMap<string, Rect | null>>(new Map());
  const [draft, setDraft] = useState<ElementTarget | null>(null);
  const [refused, setRefused] = useState(false);
  const session = useRef<PickSession>(null);
  const nonce = frame.nonce;
  const picking = writable && mode.tool === "comment" && draft === null;

  // Picking: start when comment mode turns on, cancel when it turns off or the frame changes.
  const begin = useEffectEvent(() => {
    const started = startPick(nonce, mode.keyboard ? "keyboard" : "element");
    session.current = started;
    if (started.mode === "keyboard") frame.focus();
    frame.send({ type: "pick:start", mode: started.mode });
    return started;
  });
  const end = useEffectEvent((started: ActivePick) => {
    if (session.current?.id !== started.id) return;
    session.current = null;
    frame.send({ type: "pick:cancel" });
  });
  useEffect(() => {
    if (!picking) return;
    const started = begin();
    return () => end(started);
  }, [picking, nonce, mode.keyboard]);

  // Pins: watch the anchors of the visible comments.
  const anchors = pinned.flatMap(comment => {
    const anchor = anchorOf(comment);
    return anchor ? [anchor] : [];
  });
  const anchorsKey = JSON.stringify(anchors);
  const watch = useEffectEvent(() => frame.send({ type: "anchors:watch", anchors }));
  useEffect(() => watch(), [anchorsKey, nonce]);

  // A focused thread scrolls its anchor into view.
  const focusedComment = pinned.find(comment => comment.id === mode.focused) ?? null;
  const focusedId = focusedComment?.id ?? null;
  const scrollTo = useEffectEvent(() => {
    const anchor = focusedComment?.target;
    if (anchor && anchor.kind !== "node")
      frame.send({ type: "scroll:to", selector: anchor.selector });
  });
  useEffect(() => scrollTo(), [focusedId, nonce]);

  const receive = useEffectEvent((message: Parameters<Parameters<typeof onFrameMessage>[0]>[0]) => {
    if (message.frame !== nonce) return;
    if (message.type === "anchors") {
      setRects(new Map(message.rects.map(item => [item.id, item.rect])));
      return;
    }
    if (message.type === "pick:cancel") {
      if (!acceptsPick(session.current, message.frame)) return;
      session.current = null;
      mode.setTool("select");
      return;
    }
    if (message.type !== "pick:result") return;
    // Outside a pick this shell started: a forged or late result, ignored.
    if (!acceptsPick(session.current, message.frame)) return;
    session.current = null;
    // The prototype can post a result while the real picker is still running: end it either way.
    frame.send({ type: "pick:cancel" });
    const confined = confinePick(message.target);
    if (!confined.ok) {
      setRefused(true);
      mode.setTool("select");
      return;
    }
    setRefused(false);
    setDraft(confined.target);
  });
  useEffect(() => onFrameMessage(message => receive(message)), []);

  useShortcuts({ escape: () => mode.setTool("select") }, picking);

  const box = { width: geometry.width, height: geometry.height, scale: geometry.scale };
  const cancelDraft = () => {
    setDraft(null);
    mode.setTool("select");
  };
  const submit = async (input: { body: string; attachments: string[] }) => {
    if (!draft) return;
    const created = await mutate(target.key, api =>
      api.addComment(target.key, {
        body: input.body,
        attachments: input.attachments,
        target: draft,
        context: {
          state: target.state,
          theme,
          role,
          viewport: { width: geometry.width, height: geometry.height },
        },
      })
    );
    setDraft(null);
    mode.setTool("select");
    mode.focusComment(created.id);
  };

  return (
    <div className="pointer-events-none absolute inset-0" data-testid="comment-layer">
      {pinned.map(comment => {
        const measured = rects.get(comment.id);
        if (measured === undefined || comment.target.kind === "node") return null;
        const moved = measured === null;
        const normalized = comment.target.rectNormalized;
        const rect = measured ?? {
          x: normalized.x * geometry.width,
          y: normalized.y * geometry.height,
          width: normalized.width * geometry.width,
          height: normalized.height * geometry.height,
        };
        const at = pinPosition(rect, box);
        const number = commentNumber(comment);
        const selected = comment.id === mode.focused;
        return (
          <button
            key={comment.id}
            type="button"
            data-testid="comment-pin"
            data-comment={comment.id}
            data-moved={moved || undefined}
            aria-label={t(moved ? "comment.pinMoved" : "comment.pin", { number })}
            aria-pressed={selected}
            title={comment.thread[0]?.body}
            onClick={() => mode.focusComment(selected ? null : comment.id)}
            className={cn(
              "shell-pin pointer-events-auto absolute grid size-6 -translate-y-full place-items-center rounded-full rounded-bl-none bg-primary font-mono text-[11px] font-semibold text-primary-foreground shadow-md transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              selected && "scale-110 ring-2 ring-primary-foreground",
              moved && "bg-muted text-muted-foreground ring-1 ring-dashed ring-primary/70"
            )}
            style={{ left: at.left, top: at.top }}
          >
            {number}
            {moved && (
              <span className="absolute top-full left-0 mt-0.5 rounded bg-[var(--shell-panel)] px-1 font-sans text-[9px] font-medium tracking-wide text-muted-foreground uppercase ring-1 ring-border">
                {t("comment.moved")}
              </span>
            )}
          </button>
        );
      })}
      {focusedComment && rects.get(focusedComment.id) && (
        <Outline rect={rects.get(focusedComment.id)!} scale={geometry.scale} dashed />
      )}
      {picking && (
        <div
          role="status"
          data-testid="comment-hint"
          className="absolute top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-primary/50 bg-[var(--shell-panel)] px-3 py-1.5 text-xs whitespace-nowrap shadow-lg"
        >
          <span className="size-1.5 rounded-full bg-primary" />
          {mode.keyboard ? t("comment.hintKeyboard") : t("comment.hint")}
          <Kbd>Esc</Kbd>
        </div>
      )}
      {refused && !picking && !draft && (
        <p
          role="alert"
          data-testid="comment-refused"
          className="pointer-events-auto absolute top-3 left-1/2 z-10 max-w-[90%] -translate-x-1/2 rounded-lg border border-destructive/40 bg-[var(--shell-panel)] px-3 py-1.5 text-xs text-destructive shadow-lg"
        >
          {t("comment.invalidSource")}
        </p>
      )}
      {draft && (
        <>
          <Outline rect={draft.rect} scale={geometry.scale} dashed={draft.kind === "region"} />
          <div
            className="pointer-events-auto absolute z-20 rounded-xl border border-border bg-[var(--shell-panel)] p-3 shadow-2xl"
            style={composerPosition(draft.rect, box)}
          >
            <Composer
              reviewKey={target.key}
              submitLabel={t("comment.send")}
              autoFocus
              onCancel={cancelDraft}
              onSubmit={submit}
              header={
                <DraftHeader
                  draft={draft}
                  number={nextNumber(all)}
                  meta={t("comment.meta", { state: target.state, theme, width: geometry.width })}
                />
              }
            />
          </div>
        </>
      )}
    </div>
  );
}

function Outline({ rect, scale, dashed }: { rect: Rect; scale: number; dashed?: boolean }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute rounded-md border-2 border-primary bg-[var(--shell-primary-soft)]",
        dashed && "border-dashed"
      )}
      style={{
        left: rect.x * scale,
        top: rect.y * scale,
        width: rect.width * scale,
        height: rect.height * scale,
      }}
    />
  );
}

function DraftHeader({
  draft,
  number,
  meta,
}: {
  draft: ElementTarget;
  number: number;
  meta: string;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="grid size-5 place-items-center rounded-full rounded-bl-none bg-primary font-mono text-[10px] font-semibold text-primary-foreground">
          {number}
        </span>
        <span className="text-[13px] font-medium">{t("comment.new")}</span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">{meta}</span>
      </div>
      <p className="truncate text-xs text-muted-foreground">
        {draft.kind === "region" ? t("comment.onRegion") : t("comment.on", { tag: draft.tag })}
        {draft.text ? ` · “${draft.text}”` : ""}
      </p>
      <code
        data-testid="composer-source"
        className="truncate font-mono text-[11px] text-muted-foreground"
        title={draft.source ?? draft.selector}
      >
        {draft.source ?? draft.selector}
      </code>
    </div>
  );
}
