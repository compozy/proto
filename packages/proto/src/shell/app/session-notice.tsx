/**
 * `_uiux.md` S1 and S4, one persistent notice under the top bar of a share. S1 (new version):
 * the informational style; Reload keeps the view, because the view lives in the URL, and asks
 * first when a composer holds unsent text. S4 (session ended): the warning style of the
 * session-expired banner; it says an unsent comment will be lost, and Reload goes wherever the
 * share's sign-in leads. Hidden outside a share and while the session is live.
 */
import { useState, useSyncExternalStore } from "react";

import { useT } from "../lib/i18n";
import { useShellData } from "../lib/shell-data";
import { useUnsentDraft } from "../review/drafts";
import { Button } from "../ui/button";
import { Info, RotateCcw, TriangleAlert } from "../ui/icons";
import { cn } from "../ui/utils";

export function SessionNotice() {
  const t = useT();
  const { session } = useShellData();
  const status = useSyncExternalStore(session.subscribe, () => session.status);
  const draft = useUnsentDraft();
  const [confirming, setConfirming] = useState(false);
  if (status === "live") return null;
  const ended = status === "ended";
  const reload = () => window.location.reload();
  const note = ended
    ? t(draft ? "session.endedDraft" : "session.endedNote")
    : t(confirming && draft ? "session.reloadDraft" : "session.newVersionNote");
  return (
    <div
      role={ended ? "alert" : "status"}
      data-testid="session-notice"
      data-status={status}
      className={cn(
        "flex shrink-0 items-center gap-3 border-b px-4 py-2 text-[13px]",
        ended
          ? "border-[color-mix(in_oklch,var(--tone-warning)_40%,transparent)] bg-[color-mix(in_oklch,var(--tone-warning)_12%,transparent)]"
          : "border-[color-mix(in_oklch,var(--primary)_30%,transparent)] bg-[var(--shell-primary-soft)]"
      )}
    >
      {ended ? (
        <TriangleAlert className="size-4 shrink-0 text-[var(--tone-warning)]" />
      ) : (
        <Info className="size-4 shrink-0 text-primary" />
      )}
      <span className="min-w-0 flex-1">
        <b className="font-semibold">{t(ended ? "session.ended" : "session.newVersion")}</b>{" "}
        {note}
      </span>
      {confirming && draft && !ended ? (
        <span className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
            {t("common.cancel")}
          </Button>
          <Button size="sm" className="font-semibold" onClick={reload}>
            <RotateCcw data-icon="inline-start" />
            {t("session.reloadAnyway")}
          </Button>
        </span>
      ) : (
        <Button
          size="sm"
          className="shrink-0 font-semibold"
          onClick={() => (!ended && draft ? setConfirming(true) : reload())}
        >
          <RotateCcw data-icon="inline-start" />
          {t("session.reload")}
        </Button>
      )}
    </div>
  );
}
