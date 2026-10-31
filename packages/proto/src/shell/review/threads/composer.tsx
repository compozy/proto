/**
 * The composer threads use for replies and resolve notes: comment mode's shared composer (with
 * image attachments) when it is plugged into the slots, else this text-only one. Both keep the
 * unsent text across reloads and expired sessions (`drafts.ts`).
 */
import { useState } from "react";

import { useSlots, type ComposerProps } from "../../app/slots";
import { useT } from "../../lib/i18n";
import { Button } from "../../ui/button";
import { Send } from "../../ui/icons";
import { Textarea } from "../../ui/textarea";
import { cn } from "../../ui/utils";
import { isReviewApiError } from "../api";
import { useDraft } from "../drafts";

export function Composer(props: ComposerProps) {
  const { composer: Shared } = useSlots();
  if (Shared) return <Shared {...props} />;
  return <TextComposer {...props} />;
}

function TextComposer({
  submitLabel,
  placeholder,
  autoFocus,
  draftScope,
  onSubmit,
  onCancel,
  className,
}: ComposerProps) {
  const t = useT();
  const [body, setBody, clear] = useDraft(draftScope ?? "composer");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const submit = async () => {
    if (!body.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSubmit({ body: body.trim(), attachments: [] });
      clear();
    } catch (failure) {
      setError(isReviewApiError(failure) ? failure.message : String(failure));
    }
    setSending(false);
  };
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Textarea
        value={body}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={placeholder ?? submitLabel}
        onChange={event => setBody(event.target.value)}
        onKeyDown={event => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void submit();
          }
          if (event.key === "Escape" && onCancel) {
            event.stopPropagation();
            onCancel();
          }
        }}
        className="min-h-16 resize-none bg-[var(--shell-panel)] text-[13px]"
      />
      {error && (
        <p role="alert" className="text-[11px] text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center justify-end gap-1">
        {onCancel && (
          <Button variant="ghost" size="xs" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        )}
        <Button
          size="xs"
          className="font-semibold"
          disabled={!body.trim() || sending}
          onClick={() => void submit()}
        >
          <Send data-icon="inline-start" />
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
