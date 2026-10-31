import { Button } from "@proto/ui/components/button";
import {
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

import { comments, loginForm as screen, previewUrl } from "./data";
import { FitPreview } from "./preview";

/** Canvas toolbar: the screen's states on the left, viewport and review tools on the right. */
function CanvasToolbar({
  state,
  tool,
  viewport = true,
}: {
  state: string;
  tool?: "select" | "comment";
  viewport?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 px-4 pt-4">
      <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-xl border border-border bg-[var(--shell-panel)] p-1 [scrollbar-width:none]">
        {screen.states.map((item, index) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={item.id === state}
            className={cn(
              "flex h-7 shrink-0 items-center gap-2 rounded-lg px-2.5 text-[13px] whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-foreground",
              item.id === state &&
                "bg-[var(--shell-primary-soft)] text-foreground hover:bg-[var(--shell-primary-soft)]"
            )}
          >
            <span className={cn("font-mono text-[10px]", item.id === state && "text-primary")}>
              {String(index + 1).padStart(2, "0")}
            </span>
            {item.label}
            {item.comments > 0 && (
              <span className="flex items-center gap-1 font-mono text-[10px] text-primary">
                <MessageSquare className="size-3" />
                {item.comments}
              </span>
            )}
          </button>
        ))}
      </div>
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
}: {
  state: string;
  active?: number;
  tool?: "select" | "comment";
}) {
  const pins = comments.filter(item => item.state === state && item.pin && !item.resolved);
  return (
    <div className="shell-dots flex min-h-0 min-w-0 flex-1 flex-col">
      <CanvasToolbar state={state} tool={tool} />
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
