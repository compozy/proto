/**
 * New comment on a flow, inside the comments panel: about the selected step, or the whole flow
 * when no step is selected. Same body, paste and image rules as the prototype composer.
 */
import { useState } from "react";

import { Button } from "@proto/ui/components/button";
import { Kbd } from "@proto/ui/components/kbd";
import { Textarea } from "@proto/ui/components/textarea";

import { AttachmentInput } from "./attachments";
import type { NodeTarget } from "./model";
import { useAttachments } from "./use-attachments";

export function FlowComposer({
  slug,
  target,
  onSubmit,
}: {
  slug: string;
  target: NodeTarget;
  onSubmit: (body: string, attachments: string[]) => Promise<void>;
}) {
  const uploads = useAttachments(slug);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!body.trim() || pending || !uploads.ready) return;
    setPending(true);
    setError(null);
    try {
      await onSubmit(body, uploads.ids);
      uploads.committed();
      setBody("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
    setPending(false);
  };

  return (
    <form
      className="flex flex-col gap-2 rounded-xl bg-muted/60 p-3"
      onSubmit={event => {
        event.preventDefault();
        void submit();
      }}
      data-testid="flow-comment-composer"
    >
      <p className="truncate text-xs text-muted-foreground">
        {target.node ? (
          <>
            Comment on step <span className="text-foreground">{target.label}</span>
          </>
        ) : (
          "Comment on the whole flow (select a step to comment on it)"
        )}
      </p>
      <Textarea
        value={body}
        onChange={event => setBody(event.target.value)}
        onKeyDown={event => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void submit();
          }
        }}
        onPaste={event => {
          if (event.clipboardData.files.length) {
            event.preventDefault();
            uploads.add([...event.clipboardData.files]);
          }
        }}
        placeholder="What should change in this flow?"
        aria-label="New comment"
        className="min-h-16 text-sm"
      />
      <AttachmentInput uploads={uploads} disabled={pending} />
      {error ? <p className="text-xs text-destructive">Could not save: {error}</p> : null}
      <div className="flex items-center gap-2">
        <span className="mr-auto flex items-center gap-1 text-[11px] text-muted-foreground">
          <Kbd>⌘</Kbd>
          <Kbd>↵</Kbd>
        </span>
        <Button type="submit" size="sm" disabled={!body.trim() || pending || !uploads.ready}>
          Comment
        </Button>
      </div>
    </form>
  );
}
