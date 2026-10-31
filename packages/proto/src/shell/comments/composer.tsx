import { useState } from "react";
import { Button } from "@proto/ui/components/button";
import { Kbd } from "@proto/ui/components/kbd";
import { Textarea } from "@proto/ui/components/textarea";
import { AttachmentInput } from "./attachments";
import { useAttachments } from "./use-attachments";
import type { ElementTarget } from "./model";
import type { Size } from "./dom";

export function CommentComposer({
  slug,
  target,
  scale,
  bounds,
  onCancel,
  onSubmit,
}: {
  slug: string;
  target: ElementTarget;
  scale: number;
  bounds: Size;
  onCancel: () => void;
  onSubmit: (body: string, attachments: string[]) => Promise<void>;
}) {
  const uploads = useAttachments(slug);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelWidth = 304;
  const right = (target.rect.x + target.rect.width) * scale + 12;
  const left =
    right + panelWidth <= bounds.width
      ? right
      : Math.max(8, target.rect.x * scale - panelWidth - 12);
  const top = Math.min(Math.max(8, target.rect.y * scale), Math.max(8, bounds.height - 248));

  const submit = async () => {
    if (!body.trim() || pending || !uploads.ready) return;
    setPending(true);
    setError(null);
    try {
      await onSubmit(body, uploads.ids);
      uploads.committed();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setPending(false);
    }
  };

  return (
    <form
      className="pointer-events-auto absolute flex cursor-auto flex-col gap-2.5 rounded-xl bg-popover p-3 text-popover-foreground ring-1 ring-foreground/10"
      style={{ left, top, width: panelWidth }}
      onPointerDown={event => event.stopPropagation()}
      onSubmit={event => {
        event.preventDefault();
        void submit();
      }}
      data-testid="comment-composer"
    >
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium">
          Comment on {target.kind === "region" ? "this area" : `this <${target.tag}>`}
        </p>
        {target.text ? (
          <p className="truncate text-xs text-muted-foreground">“{target.text}”</p>
        ) : null}
        <p
          className="truncate font-mono text-[11px] text-muted-foreground"
          title={target.source ?? undefined}
        >
          {target.source ?? target.selector}
        </p>
      </div>
      <Textarea
        autoFocus
        value={body}
        onChange={event => setBody(event.target.value)}
        onKeyDown={event => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void submit();
          }
          if (event.key === "Escape") {
            event.stopPropagation();
            onCancel();
          }
        }}
        onPaste={event => {
          if (event.clipboardData.files.length) {
            event.preventDefault();
            uploads.add([...event.clipboardData.files]);
          }
        }}
        placeholder="What should change here?"
        aria-label="Comment"
        className="min-h-20 text-sm"
      />
      <AttachmentInput uploads={uploads} disabled={pending} />
      {error ? <p className="text-xs text-destructive">Could not save: {error}</p> : null}
      <div className="flex items-center gap-2">
        <span className="mr-auto flex items-center gap-1 text-[11px] text-muted-foreground">
          <Kbd>⌘</Kbd>
          <Kbd>↵</Kbd>
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!body.trim() || pending || !uploads.ready}>
          Comment
        </Button>
      </div>
    </form>
  );
}
