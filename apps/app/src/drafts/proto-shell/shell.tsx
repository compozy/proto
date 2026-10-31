import { Avatar, AvatarFallback } from "@proto/ui/components/avatar";
import { Button } from "@proto/ui/components/button";
import { Kbd, KbdGroup } from "@proto/ui/components/kbd";
import { Tabs, TabsList, TabsTrigger } from "@proto/ui/components/tabs";
import {
  Check,
  Clock,
  Ellipsis,
  History,
  Layers,
  LayoutGrid,
  Link,
  MessageSquare,
  Monitor,
  Moon,
  Search,
  Settings,
  Sparkles,
  Workflow,
} from "@proto/ui/lib/icons";
import { cn } from "@proto/ui/lib/utils";
import type { ReactNode } from "react";

import { app } from "./data";

export type Area = "overview" | "flows" | "screens" | "comments" | "drafts";

const rail: { id: Area; label: string; icon: typeof LayoutGrid; dot?: boolean }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "flows", label: "Flows", icon: Workflow },
  { id: "screens", label: "Screens", icon: Monitor },
  { id: "comments", label: "Comments", icon: MessageSquare, dot: true },
  { id: "drafts", label: "Drafts", icon: Sparkles },
];

/** Icon rail: areas of the gallery, the app mark on top and the reviewer at the bottom. */
export function ShellRail({ active }: { active: Area }) {
  return (
    <nav
      aria-label="Gallery"
      className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-border bg-[var(--shell-rail)] py-3"
    >
      <div className="mb-3 grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Layers className="size-4" />
      </div>
      {rail.map(item => (
        <button
          key={item.id}
          type="button"
          aria-label={item.label}
          aria-current={item.id === active ? "page" : undefined}
          className={cn(
            "relative grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            item.id === active &&
              "bg-[var(--shell-primary-soft)] text-primary hover:bg-[var(--shell-primary-soft)] hover:text-primary"
          )}
        >
          <item.icon className="size-4" />
          {item.dot && (
            <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" />
          )}
        </button>
      ))}
      <div className="my-2 h-px w-6 bg-border" />
      <button
        type="button"
        aria-label="Settings"
        className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Settings className="size-4" />
      </button>
      <Avatar className="mt-auto size-7">
        <AvatarFallback className="bg-primary text-[10px] font-semibold text-primary-foreground">
          PN
        </AvatarFallback>
      </Avatar>
    </nav>
  );
}

/** Top bar: where am I, global search and the review actions of the open item. */
export function ShellTopBar({
  crumbs,
  open,
  approved = false,
  onSearch,
}: {
  crumbs: string[];
  open: number;
  approved?: boolean;
  onSearch?: () => void;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4 xl:px-5">
      <ol className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] whitespace-nowrap">
        {[app.name, ...crumbs].map((crumb, index, all) => (
          <li
            key={crumb}
            className={cn(
              "flex min-w-0 items-center gap-1.5",
              index === all.length - 1 ? "shrink" : "shrink-0",
              index > 0 && index < all.length - 2 && "hidden xl:flex"
            )}
          >
            {index > 0 && <span className="text-muted-foreground/50">/</span>}
            <span
              className={cn(
                "truncate",
                index === all.length - 1 ? "font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              {crumb}
            </span>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={onSearch}
        aria-label="Search"
        className="flex h-8 w-8 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-[var(--shell-panel)] text-[13px] text-muted-foreground hover:text-foreground lg:w-[clamp(14rem,28vw,26rem)] lg:shrink lg:justify-start lg:px-2.5"
      >
        <Search className="size-3.5 shrink-0" />
        <span className="hidden flex-1 truncate text-left lg:inline">
          Search screens, states or flows…
        </span>
        <KbdGroup className="hidden lg:inline-flex">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </button>
      <div className="flex shrink-0 items-center justify-end gap-2 whitespace-nowrap">
        <span className="hidden h-8 items-center gap-1.5 rounded-full border border-border px-3 text-[13px] tabular-nums md:flex">
          <span className="size-1.5 rounded-full bg-primary" />
          {open} open
        </span>
        <Button
          variant="outline"
          aria-label="Share"
          className="h-8 rounded-full max-xl:w-8 max-xl:px-0"
        >
          <Link data-icon="inline-start" />
          <span className="hidden xl:inline">Share</span>
        </Button>
        <Button className="h-8 rounded-full px-3.5 font-semibold" disabled={approved}>
          <Check data-icon="inline-start" />
          {approved ? "Approved" : "Approve"}
        </Button>
      </div>
    </header>
  );
}

export type View = "flow" | "screen" | "compare";

/** Second bar: the open item, its review status and the view switch. */
export function ShellSubHeader({
  title,
  status,
  meta,
  view,
  views = ["flow", "screen", "compare"],
  trailing,
}: {
  title: string;
  status?: ReactNode;
  meta?: string;
  view?: View;
  views?: View[];
  trailing?: ReactNode;
}) {
  return (
    <div className="grid h-12 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-border px-4 xl:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="min-w-0 truncate text-[15px] font-semibold tracking-tight">{title}</h1>
        {status}
        {meta && (
          <span className="hidden min-w-0 items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground 2xl:flex">
            <Clock className="size-3 shrink-0" />
            <span className="truncate">{meta}</span>
          </span>
        )}
      </div>
      {view ? (
        <Tabs value={view}>
          <TabsList className="h-8 rounded-lg border border-border bg-[var(--shell-panel)]">
            {views.map(item => (
              <TabsTrigger key={item} value={item} className="px-3 text-[13px] capitalize xl:px-4">
                {item === "screen" ? "Screens" : item}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : (
        <span />
      )}
      <div className="flex min-w-0 items-center justify-end gap-1 text-muted-foreground">
        {trailing}
        <Button variant="ghost" size="icon-sm" aria-label="Dark theme">
          <Moon />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="History">
          <History />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="More">
          <Ellipsis />
        </Button>
      </div>
    </div>
  );
}

/** Review status pill: pink while comments are open, green once approved. */
export function StatusPill({ open, approved = false }: { open: number; approved?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium whitespace-nowrap",
        approved
          ? "bg-[color-mix(in_oklch,var(--tone-end)_16%,transparent)] text-[var(--tone-end)]"
          : "bg-[var(--shell-primary-soft)] text-primary"
      )}
    >
      {approved ? (
        "Approved"
      ) : (
        <>
          <span className="max-xl:hidden">In review ·</span> {open} open
        </>
      )}
    </span>
  );
}

/** The shell frame: rail, top bar and the area body. */
export function Shell({ area, children }: { area: Area; children: ReactNode }) {
  return (
    <div className="proto-shell flex h-svh min-h-[720px] w-full overflow-hidden text-sm">
      <ShellRail active={area} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
