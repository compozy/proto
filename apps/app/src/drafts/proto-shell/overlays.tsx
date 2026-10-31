import { Button } from "@proto/ui/components/button";
import { Kbd } from "@proto/ui/components/kbd";
import { Textarea } from "@proto/ui/components/textarea";
import { Check, Copy, Paperclip, RotateCcw, Send, TriangleAlert, X } from "@proto/ui/lib/icons";

import { CanvasToolbar } from "./screen-view";
import { ShellModal } from "./shell";

/** Approve with open comments: say how many are still open and record them. */
export function ApproveDialog() {
  return (
    <ShellModal>
      <div className="p-6">
        <span className="grid size-10 place-items-center rounded-xl bg-[var(--shell-primary-soft)] text-primary">
          <Check className="size-5" />
        </span>
        <h2 className="mt-4 text-[17px] font-semibold tracking-tight">Approve Sign in?</h2>
        <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-[color-mix(in_oklch,var(--tone-warning)_12%,transparent)] p-3 text-[13px]">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[var(--tone-warning)]" />
          <span>
            <b className="font-semibold">2 comments are still open.</b> They stay open and are
            recorded with the approval.
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-[88px_1fr] gap-y-1.5 text-[13px]">
          <dt className="text-muted-foreground">Prototype</dt>
          <dd className="font-mono text-xs">login-form · 4 states</dd>
          <dt className="text-muted-foreground">Commit</dt>
          <dd className="font-mono text-xs">a41c9e2</dd>
        </dl>
      </div>
      <div className="flex justify-end gap-2 border-t border-border p-4">
        <Button variant="outline">Cancel</Button>
        <Button className="font-semibold">
          <Check data-icon="inline-start" />
          Approve anyway
        </Button>
      </div>
    </ShellModal>
  );
}

const shortcuts: [string, string[]][] = [
  ["Search", ["⌘", "K"]],
  ["Previous / next state", ["J", "K"]],
  ["Previous / next prototype", ["[", "]"]],
  ["Flow · Screens · Compare", ["1", "2", "3"]],
  ["Comment mode", ["C"]],
  ["Toggle theme", ["T"]],
  ["Fit canvas", ["F"]],
  ["Filter sidebar", ["/"]],
  ["Shortcuts", ["?"]],
  ["Close", ["Esc"]],
];

export function ShortcutsSheet() {
  return (
    <ShellModal width={480}>
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="text-[15px] font-semibold">Keyboard shortcuts</h2>
        <Button variant="ghost" size="icon-xs" aria-label="Close" className="text-muted-foreground">
          <X />
        </Button>
      </div>
      <ul className="grid grid-cols-1 gap-x-6 p-3 sm:grid-cols-2">
        {shortcuts.map(([label, keys]) => (
          <li
            key={label}
            className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-[13px]"
          >
            <span className="text-muted-foreground">{label}</span>
            <span className="flex gap-1">
              {keys.map(key => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </ShellModal>
  );
}

/**
 * Comment mode over a screen: hover outline on the element under the cursor, a hint pill and the
 * composer with attachments, positioned in the frame's coordinates.
 */
export function ComposeOverlay() {
  return (
    <>
      <span
        className="pointer-events-none absolute rounded-md border-2 border-primary bg-[var(--shell-primary-soft)]"
        style={{ left: "34.6%", top: "60%", width: "30.4%", height: "6%" }}
      />
      <span
        className="absolute rounded bg-primary px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap text-primary-foreground"
        style={{ left: "34.6%", top: "calc(66% + 6px)" }}
      >
        button · login-form.tsx:61
      </span>
      <div
        className="absolute w-[300px] rounded-xl border border-border bg-[var(--shell-panel)] p-3 shadow-2xl"
        style={{
          left: "max(8px, min(calc(65% + 12px), calc(100% - 308px)))",
          top: "min(48%, calc(100% - 280px))",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="grid size-5 place-items-center rounded-full bg-primary font-mono text-[10px] font-semibold text-primary-foreground">
            8
          </span>
          <span className="text-[13px] font-medium">New comment</span>
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            error · dark · 1024
          </span>
        </div>
        <Textarea
          defaultValue="Primary button reads as disabled in dark. Needs more contrast."
          className="mt-2.5 min-h-20 resize-none bg-background text-[13px]"
        />
        <div className="mt-2 flex gap-1.5">
          {["from-pink-400/70 to-fuchsia-600/70", "from-sky-400/60 to-indigo-600/60"].map(
            gradient => (
              <span
                key={gradient}
                className={`relative size-11 rounded-md bg-gradient-to-br ${gradient}`}
              >
                <X className="absolute -top-1 -right-1 size-3.5 rounded-full bg-background p-0.5" />
              </span>
            )
          )}
        </div>
        <p className="mt-2 text-[11px] text-destructive">
          brief.png is 7.2 MB · images are limited to 5 MB
        </p>
        <div className="mt-2.5 flex items-center gap-1">
          <Button variant="ghost" size="icon-xs" aria-label="Attach image">
            <Paperclip />
          </Button>
          <span className="font-mono text-[10px] text-muted-foreground">2 / 6</span>
          <Button variant="ghost" size="xs" className="ml-auto">
            Cancel
          </Button>
          <Button size="xs" className="font-semibold">
            <Send data-icon="inline-start" />
            Comment
          </Button>
        </div>
      </div>
    </>
  );
}

export function ComposeHint() {
  return (
    <div className="pointer-events-none absolute top-[68px] left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-primary/50 bg-[var(--shell-panel)] px-3 py-1.5 text-xs whitespace-nowrap shadow-lg">
      <span className="size-1.5 rounded-full bg-primary" />
      Click an element or drag a region
      <Kbd>Esc</Kbd>
    </div>
  );
}

/** A state that threw while rendering: the error stays inside its frame. */
export function RenderErrorCanvas() {
  return (
    <div className="shell-dots flex min-h-0 min-w-0 flex-1 flex-col">
      <CanvasToolbar state="pending" tool="select" />
      <div className="grid min-h-0 flex-1 place-items-center p-6">
        <div className="shell-frame w-full max-w-[640px] overflow-hidden rounded-xl bg-[var(--shell-panel)]">
          <div className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2.5 text-[13px] font-medium text-destructive">
            <TriangleAlert className="size-4" />
            Submitting failed to render
          </div>
          <div className="p-4">
            <p className="font-mono text-[13px]">
              TypeError: Cannot read properties of undefined (reading 'email')
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-background p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {`at LoginForm (src/components/login-form.tsx:42:31)
at Prototype (src/components/login-form.proto.tsx:24:5)
at Canvas (proto.canvas.tsx:9:10)`}
            </pre>
            <div className="mt-4 flex gap-2">
              <Button size="sm" className="font-semibold">
                <RotateCcw data-icon="inline-start" />
                Reload state
              </Button>
              <Button variant="outline" size="sm">
                <Copy data-icon="inline-start" />
                Copy error
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
