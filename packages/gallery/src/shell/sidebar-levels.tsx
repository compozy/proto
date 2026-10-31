/**
 * Rows and panels of the gallery's drill-down navigation (`sidebar.tsx`): spec rows (level 1),
 * search results, prototype rows (level 2) and the states of one prototype (level 3). Every row
 * is a numbered link with its own URL (`selectionHref`); a plain click adds a history entry. Flow
 * rows live in `sidebar-flows.tsx`.
 */
import type { ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@proto/ui/lib/icons";

import { SidebarMenu, SidebarMenuItem } from "@proto/ui/components/sidebar";

import type { FlowEntry } from "../flow";
import type { ReviewComment } from "./comments/model";
import {
  isUncovered,
  specSlug,
  stateFlowCount,
  touchedByFlows,
  type Entry,
  type Group,
  type Registry,
} from "./registry-model";
import { FlowResults } from "./sidebar-flows";
import { CommentDot, GroupHeading, NavLink, RowGroup, RowNumber } from "./sidebar-rows";
import { plural } from "./sidebar-model";
import { plainClick, select, useSelectionHref, type Selection } from "./view";

/** Link one level up: the parent's own URL, so Back and Esc land on a shareable view. */
export function BackRow({ label, target }: { label: string; target: Selection }) {
  const hrefOf = useSelectionHref();
  return (
    <a
      href={hrefOf(target)}
      onClick={event => {
        if (plainClick(event)) select(target);
      }}
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-left text-[13px] text-muted-foreground outline-none transition-colors hover:bg-card/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-inset dark:hover:bg-sidebar-accent/60"
      data-testid="nav-back"
    >
      <ChevronLeftIcon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </a>
  );
}

export function LevelHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex shrink-0 flex-col gap-1 px-3">
      {eyebrow ? (
        <span className="font-mono text-[11px] text-primary dark:text-accent-foreground">
          {eyebrow}
        </span>
      ) : null}
      <h2 className="text-[16px] leading-snug font-medium">{title}</h2>
      {children}
    </header>
  );
}

export function SpecRow({
  group,
  index,
  active,
  openComments,
}: {
  group: Group;
  /** Position among the specs; "Unsorted" has none. */
  index: number | null;
  active: boolean;
  openComments: number;
}) {
  return (
    <SidebarMenuItem data-group={group.id}>
      <NavLink target={{ kind: "spec", spec: group.id }} active={active} data-testid="nav-spec">
        {index === null ? (
          <span className="w-5 shrink-0" aria-hidden />
        ) : (
          <RowNumber index={index} />
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[14px] leading-snug group-aria-[current]/menu-button:font-medium">
            {group.title}
          </span>
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {specSlug(group)}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 pt-0.5 font-mono text-[11px] text-muted-foreground">
          <CommentDot count={openComments} label="open comments" />
          <ChevronRightIcon className="size-3.5" aria-hidden />
        </span>
      </NavLink>
    </SidebarMenuItem>
  );
}

export function PrototypeRow({
  entry,
  index,
  active,
  openComments,
  onNavigate,
}: {
  entry: Entry;
  /** Position in the spec; search results have none. */
  index: number | null;
  active: boolean;
  openComments: number;
  onNavigate?: () => void;
}) {
  const { meta } = entry;
  return (
    <SidebarMenuItem data-slug={entry.slug}>
      <NavLink
        target={{ kind: "prototype", slug: entry.slug }}
        active={active}
        onNavigate={onNavigate}
        data-testid="nav-prototype"
      >
        {index === null ? null : <RowNumber index={index} />}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[14px] leading-snug group-aria-[current]/menu-button:font-medium">
            {meta.title}
          </span>
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {meta.surface} · {meta.route}
            {entry.kind === "draft" ? " · Draft" : ""}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 pt-0.5 font-mono text-[11px] text-muted-foreground">
          <CommentDot count={openComments} label="open comments" />
          <span title={plural(meta.states.length, "state")}>{meta.states.length}</span>
        </span>
      </NavLink>
    </SidebarMenuItem>
  );
}

/** Flat search results: flows, prototypes, then states; opening one clears the search. */
export function SearchResults({
  flows,
  activeFlow,
  prototypes,
  states,
  openOf,
  onNavigate,
  onDone,
}: {
  flows: FlowEntry[];
  activeFlow: string | null;
  prototypes: Entry[];
  states: { entry: Entry; id: string; label: string }[];
  openOf: (slug: string) => number;
  onNavigate: () => void;
  onDone: () => void;
}) {
  if (flows.length === 0 && prototypes.length === 0 && states.length === 0) {
    return <p className="px-3 py-4 text-sm text-muted-foreground">Nothing found.</p>;
  }
  return (
    <>
      <FlowResults flows={flows} activeFlow={activeFlow} onNavigate={onDone} />
      {prototypes.length > 0 ? (
        <RowGroup label="Prototypes found" heading={<GroupHeading title="Prototypes" />}>
          {prototypes.map(entry => (
            <PrototypeRow
              key={entry.slug}
              entry={entry}
              index={null}
              active={false}
              openComments={openOf(entry.slug)}
              onNavigate={onNavigate}
            />
          ))}
        </RowGroup>
      ) : null}
      {states.length > 0 ? (
        <RowGroup label="States found" heading={<GroupHeading title="States" />}>
          {states.map(item => (
            <SidebarMenuItem key={`${item.entry.slug}:${item.id}`}>
              <NavLink
                target={{ kind: "prototype", slug: item.entry.slug, state: item.id }}
                active={false}
                onNavigate={onDone}
                className="flex-col gap-0.5"
              >
                <span className="text-[13.5px] leading-snug">{item.label}</span>
                <span className="truncate font-mono text-[11px] text-muted-foreground">
                  {item.entry.meta.surface} · {item.entry.meta.title}
                </span>
              </NavLink>
            </SidebarMenuItem>
          ))}
        </RowGroup>
      ) : null}
    </>
  );
}

function FlowCount({ count }: { count: number }) {
  const label = count === 0 ? "In no flow" : `In ${plural(count, "flow")}`;
  return (
    <span className="min-w-3 text-right tabular-nums" title={label} data-testid="state-flow-count">
      {count}
      <span className="sr-only"> {label.toLowerCase()}</span>
    </span>
  );
}

export function StateList({
  entry,
  registry,
  group,
  state,
  comments,
  onNavigate,
}: {
  entry: Entry;
  registry: Registry;
  group: Group | undefined;
  state: string;
  comments: ReviewComment[];
  onNavigate?: () => void;
}) {
  const open = comments.filter(comment => comment.status === "open");
  // Flow counts and uncovered dots only where a flow owns or crosses the spec.
  const touched = group ? touchedByFlows(registry, group.id) : false;
  return (
    <SidebarMenu className="min-h-0 flex-1 gap-0.5 overflow-y-auto pb-2">
      {entry.meta.states.map((option, index) => (
        <SidebarMenuItem key={option.id}>
          <NavLink
            target={{ kind: "prototype", slug: entry.slug, state: option.id }}
            active={option.id === state}
            onNavigate={onNavigate}
            className="min-h-9 text-[13.5px] leading-snug text-muted-foreground hover:text-foreground aria-[current]:font-medium aria-[current]:text-foreground"
            data-testid="nav-state"
          >
            <RowNumber index={index} />
            <span className="min-w-0 flex-1 whitespace-normal">
              {option.label}
              {touched && isUncovered(registry, entry.slug, option.id) ? (
                <span
                  className="ml-1.5 inline-block size-[7px] rounded-full bg-warning align-middle"
                  role="img"
                  aria-label="In no flow"
                  title="In no flow"
                  data-testid="state-uncovered"
                />
              ) : null}
            </span>
            <span className="flex shrink-0 items-center gap-2 pt-px font-mono text-[11px]">
              <CommentDot
                count={open.filter(comment => comment.context.state === option.id).length}
                label="open comments in this state"
              />
              {touched ? (
                <FlowCount count={stateFlowCount(registry, entry.slug, option.id)} />
              ) : null}
            </span>
          </NavLink>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
