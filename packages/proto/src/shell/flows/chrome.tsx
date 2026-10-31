/**
 * Canvas chrome around the flow: legend of the edge kinds (behind "Legend" on phones), the
 * uncovered-state warnings, the layout status region and the zoom controls.
 */
import { useState } from "react";
import { useReactFlow, useStore } from "@xyflow/react";
import { MinusIcon, PlusIcon, ScanIcon, TriangleAlertIcon } from "@proto/ui/lib/icons";

import { Button } from "@proto/ui/components/button";
import { cn } from "@proto/ui/lib/utils";

import { edgeKinds, type CoverageWarning } from "../../flow";
import { edgeKindStyle, viewportDuration } from "./edge-style";
import type { LayoutStatus } from "./layout-state";
import { plainClick, select, useSelectionHref } from "../view";

const surface = "rounded-[10px] bg-card text-[12px] text-muted-foreground";
const chromeButton = "bg-card text-foreground hover:bg-muted";

function LineSample({
  dash,
  round,
  highlighted,
}: {
  dash?: string;
  round?: boolean;
  highlighted?: boolean;
}) {
  return (
    <svg width="26" height="6" className="shrink-0" aria-hidden>
      <line
        x1="1"
        y1="3"
        x2="25"
        y2="3"
        style={{
          stroke: highlighted ? "var(--color-ring)" : "var(--color-muted-foreground)",
          strokeWidth: highlighted ? 2.2 : 1.6,
          strokeDasharray: dash,
          strokeLinecap: round ? "round" : undefined,
        }}
      />
    </svg>
  );
}

function LegendItems() {
  return (
    <>
      {edgeKinds.map(kind => (
        <li key={kind} className="flex items-center gap-1.5">
          <LineSample dash={edgeKindStyle[kind].dash} round={edgeKindStyle[kind].round} />
          {edgeKindStyle[kind].label}
        </li>
      ))}
      <li className="flex items-center gap-1.5 text-ring">
        <LineSample highlighted />
        path of the selected step
      </li>
    </>
  );
}

export function FlowLegend() {
  const [open, setOpen] = useState(false);
  return (
    <div className="pointer-events-auto">
      <ul
        className={cn(surface, "hidden flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 lg:flex")}
        aria-label="Legend"
      >
        <LegendItems />
      </ul>
      <div className="lg:hidden">
        <Button
          variant="secondary"
          className={chromeButton}
          size="sm"
          aria-expanded={open}
          aria-controls="flow-legend"
          onClick={() => setOpen(!open)}
        >
          Legend
        </Button>
        {open ? (
          <ul
            id="flow-legend"
            className={cn(surface, "mt-1.5 flex flex-col gap-1.5 px-3 py-2")}
            aria-label="Legend"
          >
            <LegendItems />
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/** "N warnings": prototype states of the crossed specs that no flow reaches, each a link. */
export function FlowWarnings({ warnings }: { warnings: CoverageWarning[] }) {
  const hrefOf = useSelectionHref();
  const [open, setOpen] = useState(false);
  if (warnings.length === 0) return null;
  const count = `${warnings.length} ${warnings.length === 1 ? "warning" : "warnings"}`;
  return (
    <div className="pointer-events-auto flex max-w-80 flex-col items-end gap-1.5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="flow-warnings"
        onClick={() => setOpen(!open)}
        className={cn(
          surface,
          "flex items-center gap-1.5 px-3 py-2 text-left whitespace-nowrap outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        )}
        data-testid="flow-warnings"
      >
        <TriangleAlertIcon className="size-3.5 shrink-0 text-warning" aria-hidden />
        <span className="font-medium text-warning-foreground">{count}</span>
        <span className="hidden xl:inline">· states in no flow</span>
      </button>
      {open ? (
        <ul
          id="flow-warnings"
          className="flex max-h-72 w-full flex-col gap-0.5 overflow-y-auto rounded-[14px] bg-popover p-1.5 text-popover-foreground"
        >
          {warnings.map(warning => {
            const target = {
              kind: "prototype",
              slug: warning.slug,
              state: warning.state,
            } as const;
            return (
              <li key={`${warning.slug}:${warning.state}`}>
                <a
                  href={hrefOf(target)}
                  onClick={event => {
                    if (plainClick(event)) select(target);
                  }}
                  className="flex flex-col rounded-[10px] px-2.5 py-1.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="font-mono text-[11.5px]">
                    {warning.slug} · {warning.state}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{warning.spec}</span>
                </a>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export function LayoutStatusRegion({
  status,
  onRetry,
}: {
  status: LayoutStatus;
  onRetry: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      {status === "failed" ? (
        <div className="pointer-events-auto flex flex-col items-center gap-3 rounded-[20px] bg-card p-5 text-center">
          <p className="text-[14px]">Could not lay out the flow</p>
          <Button size="sm" onClick={onRetry} data-testid="flow-layout-retry">
            Try again
          </Button>
        </div>
      ) : status === "ready" ? null : (
        <p className="rounded-[10px] bg-card px-3 py-2 text-[13px] text-muted-foreground">
          Laying out the flow…
        </p>
      )}
    </div>
  );
}

export function ZoomControls({ onFit }: { onFit: () => void }) {
  const { zoomIn, zoomOut } = useReactFlow();
  // Rounded in the selector, so a zoom gesture re-renders only when the shown percentage changes.
  const percent = useStore(state => Math.round(state.transform[2] * 100));
  return (
    <div className="pointer-events-auto flex items-center gap-1" role="group" aria-label="Zoom">
      <Button
        variant="secondary"
        className={chromeButton}
        size="icon-sm"
        aria-label="Zoom out"
        onClick={() => void zoomOut({ duration: viewportDuration() })}
      >
        <MinusIcon />
      </Button>
      <span className="min-w-12 rounded-[8px] bg-card px-2 py-1 text-center font-mono text-[12px] text-muted-foreground">
        {percent}%
      </span>
      <Button
        variant="secondary"
        className={chromeButton}
        size="icon-sm"
        aria-label="Zoom in"
        onClick={() => void zoomIn({ duration: viewportDuration() })}
      >
        <PlusIcon />
      </Button>
      <Button
        variant="secondary"
        className={chromeButton}
        size="sm"
        onClick={onFit}
        data-testid="flow-fit"
      >
        <ScanIcon />
        Fit
      </Button>
    </div>
  );
}
