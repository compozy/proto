/**
 * Gallery keyboard shortcuts. They listen on the gallery and inside the canvas iframe (same
 * origin), and stay quiet while typing in a field or with a modifier held.
 */
import { KeyboardIcon } from "@proto/ui/lib/icons";

import { Button } from "@proto/ui/components/button";
import { Kbd } from "@proto/ui/components/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@proto/ui/components/popover";

const shortcutList: { keys: string[]; label: string }[] = [
  { keys: ["J"], label: "Next prototype (or flow)" },
  { keys: ["K"], label: "Previous prototype (or flow)" },
  { keys: ["]"], label: "Next state (or flow step)" },
  { keys: ["["], label: "Previous state (or flow step)" },
  { keys: ["T"], label: "Toggle light/dark theme" },
  { keys: ["C"], label: "Comment mode (click or drag)" },
  { keys: ["Esc"], label: "Leave comment mode" },
  { keys: ["/"], label: "Search prototypes and flows" },
  { keys: ["⌘", "B"], label: "Show or hide the sidebar" },
  { keys: ["?"], label: "Show shortcuts" },
];

export function ShortcutsHelp({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Keyboard shortcuts (?)">
            <KeyboardIcon />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-72">
        <p className="text-sm font-medium">Shortcuts</p>
        <dl className="flex flex-col gap-1.5">
          {shortcutList.map(item => (
            <div key={item.label} className="flex items-center gap-3 text-[13px]">
              <dt className="flex w-12 shrink-0 gap-1">
                {item.keys.map(key => (
                  <Kbd key={key} className="font-mono">
                    {key}
                  </Kbd>
                ))}
              </dt>
              <dd className="text-muted-foreground">{item.label}</dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}
