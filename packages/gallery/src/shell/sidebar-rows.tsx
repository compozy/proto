/**
 * Building blocks of the sidebar rows on `@proto/ui`'s `Sidebar`: numbered links to a selection
 * and titled row groups. Shared by the drill-down levels and the flow rows.
 */
import type { ReactNode } from "react";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
} from "@proto/ui/components/sidebar";
import { cn } from "@proto/ui/lib/utils";

import { ordinal, rowClass } from "./sidebar-model";
import { plainClick, select, useSelectionHref, type Selection } from "./view";

/** A sidebar link to a selection: plain clicks navigate in place (with history), others open a tab. */
export function NavLink({
  target,
  active,
  onNavigate,
  className,
  children,
  ...props
}: {
  target: Selection;
  active: boolean;
  onNavigate?: () => void;
  className?: string;
  children: ReactNode;
  "data-testid"?: string;
}) {
  const hrefOf = useSelectionHref();
  return (
    <SidebarMenuButton
      isActive={active}
      aria-current={active ? "page" : undefined}
      className={cn(rowClass, className)}
      render={
        <a
          href={hrefOf(target)}
          onClick={event => {
            if (!plainClick(event)) return;
            if (!active) select(target);
            onNavigate?.();
          }}
        />
      }
      {...props}
    >
      {children}
    </SidebarMenuButton>
  );
}

/** Row number (`01`), in the order of its list. */
export function RowNumber({ index }: { index: number }) {
  return (
    <span className="w-5 shrink-0 pt-px font-mono text-[11px] text-muted-foreground tabular-nums">
      {ordinal(index)}
    </span>
  );
}

export function GroupHeading({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <SidebarGroupLabel className="h-auto justify-between px-3 pt-3 pb-1 font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
      <span>{title}</span>
      {aside ? <span className="font-normal tracking-normal normal-case">{aside}</span> : null}
    </SidebarGroupLabel>
  );
}

/** A titled list of rows (`SidebarGroup` + `SidebarMenu`). */
export function RowGroup({
  label,
  heading,
  children,
  ...props
}: {
  label: string;
  heading?: ReactNode;
  children: ReactNode;
  "data-testid"?: string;
}) {
  return (
    <SidebarGroup className="p-0" aria-label={label} {...props}>
      {heading}
      <SidebarMenu className="gap-0.5">{children}</SidebarMenu>
    </SidebarGroup>
  );
}

/** Open comments of a row, as a blue dot and count. */
export function CommentDot({ count, label }: { count: number; label: string }) {
  if (count === 0) return null;
  return (
    <span
      className="flex items-center gap-1 text-primary dark:text-accent-foreground"
      title={`${count} ${label}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {count}
    </span>
  );
}
