import { Button } from "@proto/ui/components/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@proto/ui/components/combobox";
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  MessageSquarePlus,
  Monitor,
  Moon,
  MousePointer2,
  Smartphone,
  Sun,
  Tablet,
} from "@proto/ui/lib/icons";
import { cn } from "@proto/ui/lib/utils";
import type { ReactNode } from "react";

import { comments, loginForm as screen, previewUrl } from "./data";
import { FitPreview } from "./preview";

type StateItem = (typeof screen.states)[number];

/**
 * State picker: a searchable combobox (a prototype can have dozens of states) with the open
 * comment count per state, plus previous/next buttons (J/K).
 */
function StatePicker({ state, open }: { state: string; open: boolean }) {
  const index = Math.max(
    0,
    screen.states.findIndex(item => item.id === state)
  );
  const current = screen.states[index];
  const number = (item: StateItem) => String(screen.states.indexOf(item) + 1).padStart(2, "0");
  return (
    <div className="flex min-w-0 items-center gap-1 rounded-xl border border-border bg-[var(--shell-panel)] p-1">
      <Combobox
        items={screen.states}
        defaultValue={current}
        defaultOpen={open}
        itemToStringValue={(item: StateItem) => item.label}
      >
        <ComboboxTrigger
          render={
            <Button
              variant="ghost"
              className="h-7 w-[260px] min-w-0 justify-between gap-2 px-2.5 text-[13px] font-normal max-sm:w-[180px]"
            />
          }
        >
          <ComboboxValue>
            {(item: StateItem) => (
              <span className="flex min-w-0 items-center gap-2">
                <span className="font-mono text-[10px] text-primary">{number(item)}</span>
                <span className="truncate">{item.label}</span>
                {item.comments > 0 && (
                  <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] text-primary">
                    <MessageSquare className="size-3" />
                    {item.comments}
                  </span>
                )}
              </span>
            )}
          </ComboboxValue>
        </ComboboxTrigger>
        <ComboboxContent className="w-[300px] min-w-[300px] bg-[var(--shell-panel)]">
          <ComboboxInput showTrigger={false} placeholder="Search states…" />
          <ComboboxEmpty>No state matches.</ComboboxEmpty>
          <ComboboxList>
            {(item: StateItem) => (
              <ComboboxItem key={item.id} value={item} className="gap-2.5 py-1.5 text-[13px]">
                <span className="font-mono text-[10px] text-muted-foreground">{number(item)}</span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.comments > 0 && (
                  <span className="flex items-center gap-1 font-mono text-[10px] text-primary">
                    <MessageSquare className="size-3" />
                    {item.comments}
                  </span>
                )}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <span className="hidden px-1 font-mono text-[10px] whitespace-nowrap text-muted-foreground sm:inline">
        {index + 1} / {screen.states.length}
      </span>
      <Button variant="ghost" size="icon-sm" aria-label="Previous state (J)" disabled={index === 0}>
        <ChevronLeft />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Next state (K)"
        disabled={index === screen.states.length - 1}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}

/** Canvas toolbar: the screen's states on the left, viewport and review tools on the right. */
export function CanvasToolbar({
  state,
  tool,
  viewport = true,
  pickerOpen = false,
}: {
  state: string;
  tool?: "select" | "comment";
  viewport?: boolean;
  /** Contract state with the state picker open. */
  pickerOpen?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 px-4 pt-4">
      <StatePicker state={state} open={pickerOpen} />
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {viewport && (
          <div className="flex items-center gap-0.5 rounded-xl border border-border bg-[var(--shell-panel)] p-1">
            {[
              { id: "desktop", icon: Monitor },
              { id: "tablet", icon: Tablet },
              { id: "phone", icon: Smartphone },
            ].map(item => (
              <Button
                key={item.id}
                variant="ghost"
                size="icon-sm"
                aria-label={item.id}
                className={cn(item.id === "desktop" && "bg-accent text-foreground")}
              >
                <item.icon />
              </Button>
            ))}
            <span className="hidden px-2 font-mono text-xs tabular-nums xl:inline">1024</span>
          </div>
        )}
        {tool && (
          <div className="flex items-center gap-0.5 rounded-xl border border-border bg-[var(--shell-panel)] p-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Select"
              className={cn(tool === "select" && "bg-[var(--shell-primary-soft)] text-primary")}
            >
              <MousePointer2 />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Comment (C)"
              className={cn(tool === "comment" && "bg-[var(--shell-primary-soft)] text-primary")}
            >
              <MessageSquarePlus />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Screen canvas: the live state fitted to the dotted surface, with pinned comments. */
export function ScreenCanvas({
  state,
  active,
  tool = "select",
  extra,
  pickerOpen = false,
}: {
  pickerOpen?: boolean;
  state: string;
  active?: number;
  /** `null` in a read-only build: no comment tool at all. */
  tool?: "select" | "comment" | null;
  /** More overlay content in frame coordinates (comment mode). */
  extra?: ReactNode;
}) {
  const pins = comments.filter(item => item.state === state && item.pin && !item.resolved);
  return (
    <div className="shell-dots flex min-h-0 min-w-0 flex-1 flex-col">
      <CanvasToolbar state={state} tool={tool ?? undefined} pickerOpen={pickerOpen} />
      <FitPreview
        src={previewUrl(screen.slug, state)}
        title="Sign in"
        width={1024}
        height={640}
        fit="contain"
        className="flex-1 px-6 pt-5 pb-2"
        frameClassName="shell-frame rounded-xl"
        overlay={
          <>
            {pins.map(pin => (
              <span
                key={pin.id}
                className={cn(
                  "shell-pin absolute grid size-6 -translate-y-full place-items-center rounded-full rounded-bl-none bg-primary font-mono text-[11px] font-semibold text-primary-foreground",
                  pin.id === active && "scale-110"
                )}
                style={{ left: `${pin.pin?.x ?? 0}%`, top: `${pin.pin?.y ?? 0}%` }}
              >
                {pin.id}
              </span>
            ))}
            {active && (
              <span
                className="pointer-events-none absolute rounded-md border-2 border-dashed border-primary/80 bg-[var(--shell-primary-soft)]"
                style={{ left: "34.6%", top: "54%", width: "17.4%", height: "4.8%" }}
              />
            )}
            {extra}
          </>
        }
      />
      <span className="shrink-0 pb-3 text-center font-mono text-[11px] text-muted-foreground">
        login-form · {state} · 1024 × 640
      </span>
    </div>
  );
}

/** Compare view: the same state in light and dark, side by side at the same width. */
export function CompareCanvas({ state }: { state: string }) {
  return (
    <div className="shell-dots flex min-h-0 min-w-0 flex-1 flex-col">
      <CanvasToolbar state={state} viewport={false} />
      <div className="grid min-h-0 flex-1 grid-cols-2 content-center gap-4 px-6 py-5 xl:gap-8">
        {(["light", "dark"] as const).map(theme => (
          <div key={theme} className="flex min-w-0 flex-col gap-2.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {theme === "light" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
              <span className="font-mono tracking-[0.08em] uppercase">{theme}</span>
              <span className="ml-auto font-mono">1024</span>
            </div>
            <FitPreview
              src={previewUrl(screen.slug, state, theme)}
              title={`Sign in ${theme}`}
              width={1024}
              height={640}
              frameClassName="shell-frame rounded-xl"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
