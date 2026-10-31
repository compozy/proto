/** S19 shortcut sheet. */
import { useT } from "../lib/i18n";
import type { MessageKey } from "../lib/messages";
import { shortcutRows } from "../lib/shortcuts";
import { Button } from "../ui/button";
import { X } from "../ui/icons";
import { Kbd } from "../ui/kbd";
import { ShellModal } from "./chrome";

export function ShortcutsSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <ShellModal label={t("shortcuts.title")} onClose={onClose} width={480}>
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="text-[15px] font-semibold">{t("shortcuts.title")}</h2>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t("common.close")}
          className="text-muted-foreground"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 p-3 sm:grid-cols-2">
        {shortcutRows.map(row => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-[13px]"
          >
            <dt className="text-muted-foreground">{t(row.label as MessageKey)}</dt>
            <dd className="flex gap-1">
              {row.keys.map(key => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </ShellModal>
  );
}
