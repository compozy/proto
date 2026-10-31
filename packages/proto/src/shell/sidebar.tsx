/**
 * Gallery navigation on `@proto/ui`'s `Sidebar` (collapsible with the trigger or Cmd/Ctrl+B, a
 * sheet on phones), with the search on top and a three-level drill-down that slides horizontally:
 * 1. specs (plus "Unsorted") and "Journeys" (every flow);
 * 2. the spec on screen: "Spec flows", "Crossing this spec" and its prototypes ("Screens");
 * 3. the states of the open prototype.
 * The level follows the URL (`use-selection.ts`), so every row and Back link is a shareable view.
 * All levels stay mounted (hidden ones are `inert`), so each keeps its scroll; Back or `Esc` goes
 * up one level, and focus lands on the new level's Back link or on the row you came from.
 */
import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";
import { config } from "virtual:gallery-app";
import { SearchIcon } from "@proto/ui/lib/icons";

import { Kbd } from "@proto/ui/components/kbd";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInput,
  SidebarRail,
  useSidebar,
} from "@proto/ui/components/sidebar";
import { cn } from "@proto/ui/lib/utils";

import type { FlowEntry } from "../flow";
import type { CommentCounts, ReviewComment } from "./comments/model";
import {
  flowMatches,
  groupOf,
  specPosition,
  type Entry,
  type Group,
  type GroupId,
  type Registry,
} from "./registry-model";
import {
  levels,
  matches,
  offsets,
  ordinal,
  plural,
  specCode,
  type NavLevel,
} from "./sidebar-model";
import { JourneyGroup, SpecFlowGroups } from "./sidebar-flows";
import {
  BackRow,
  LevelHeader,
  PrototypeRow,
  SearchResults,
  SpecRow,
  StateList,
} from "./sidebar-levels";
import { GroupHeading, RowGroup } from "./sidebar-rows";
import { select, type Selection } from "./view";

type SidebarProps = {
  registry: Registry;
  /** Prototype on screen (null on the index, a spec, a flow or the missing-flow notice). */
  current: Entry | null;
  /** Flow on screen. */
  flow: FlowEntry | null;
  /** Spec of what is on screen (spec overview, flow owner or prototype spec). */
  active: GroupId | null;
  state: string;
  level: NavLevel;
  query: string;
  onQuery: (query: string) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  counts: CommentCounts;
  /** Comments of the current prototype, for the per-state counts on level 3. */
  comments: ReviewComment[];
};

type Nav = Omit<SidebarProps, "searchRef"> & {
  group: Group | undefined;
  openOf: (slug: string) => number;
  /** A final destination was opened (state, flow): close the phone sheet. */
  done: () => void;
};

/** Where Back (and `Esc`) leads from each level. */
function parentOf(level: NavLevel, group: Group | undefined): Selection | null {
  if (level === "states" && group) return { kind: "spec", spec: group.id };
  return level === "specs" ? null : { kind: "index" };
}

export function GallerySidebar(props: SidebarProps) {
  const { registry, level, query, counts } = props;
  const { isMobile, setOpenMobile } = useSidebar();
  const rootRef = useRef<HTMLDivElement>(null);
  const prototypesListRef = useRef<HTMLDivElement>(null);
  const navigating = useRef(false);
  const origins = useRef<Partial<Record<NavLevel, string>>>({});
  const slug = props.current?.slug ?? null;
  const previous = useRef({ level, active: props.active, slug });
  const group = groupOf(registry, props.active) ?? registry.groups[0];
  const needle = query.trim().toLowerCase();
  const openOf = (slug: string) => counts[slug]?.open ?? 0;

  // A new spec starts its list from the top.
  useEffect(() => {
    prototypesListRef.current?.scrollTo({ top: 0 });
  }, [group?.id]);

  // After navigating inside the sidebar, focus follows to the level now visible: its Back link
  // when going down, the row you came from when going up.
  useEffect(() => {
    const from = previous.current;
    previous.current = { level, active: props.active, slug };
    const shouldFocus = navigating.current && from.level !== level;
    navigating.current = false;
    if (!shouldFocus) return;
    const panel = rootRef.current?.querySelector(`[data-testid="nav-${level}"]`);
    const deeper = levels.indexOf(level) > levels.indexOf(from.level);
    const source = level === "specs" ? from.active : from.slug;
    const attribute = level === "specs" ? "data-group" : "data-slug";
    const origin = origins.current[level];
    const row =
      (origin ? panel?.querySelector<HTMLElement>(origin) : null) ??
      (source
        ? panel?.querySelector<HTMLElement>(`[${attribute}="${CSS.escape(source)}"] a[href]`)
        : null);
    const target = deeper
      ? panel?.querySelector<HTMLElement>('[data-testid="nav-back"]')
      : (row ?? panel?.querySelector<HTMLElement>("a[href]"));
    target?.focus({ preventScroll: true });
  }, [level, props.active, slug]);

  const onEscape = (event: KeyboardEvent) => {
    const parent = parentOf(level, group);
    if (event.key !== "Escape" || !parent || needle) return;
    event.preventDefault();
    event.stopPropagation();
    navigating.current = true;
    select(parent);
  };

  const { searchRef, ...rest } = props;
  const nav: Nav = {
    ...rest,
    group,
    openOf,
    done: () => {
      if (isMobile) setOpenMobile(false);
    },
  };

  return (
    <Sidebar
      collapsible="offcanvas"
      className="border-r-0 [&_[data-slot=sidebar-inner]]:bg-sidebar"
      data-testid="gallery-sidebar"
    >
      <nav aria-label="Prototypes" className="flex min-h-0 flex-1 flex-col">
        <SidebarHeader className="gap-3 p-3 pb-1">
          <div className="flex items-baseline gap-2 px-2 pt-1">
            <span className="truncate text-[15px] font-semibold tracking-[-0.01em]">
              {config.title}
            </span>
            <span className="font-mono text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
              Prototypes
            </span>
          </div>
          <SearchField nav={nav} searchRef={searchRef} />
        </SidebarHeader>
        <SidebarContent
          ref={rootRef}
          className="relative overflow-hidden px-0 pt-2 pb-0"
          data-level={level}
          onKeyDown={onEscape}
          onClickCapture={event => {
            navigating.current = true;
            // Keep the originating row even when a flow opens its owner's spec level.
            const row = (event.target as HTMLElement).closest(
              "[data-group], [data-slug], [data-flow]"
            );
            for (const attribute of ["data-group", "data-slug", "data-flow"]) {
              const value = row?.getAttribute(attribute);
              if (value) origins.current[level] = `[${attribute}="${CSS.escape(value)}"] a[href]`;
            }
          }}
        >
          {needle ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-2">
              <SearchHits nav={nav} />
            </div>
          ) : (
            <div
              className={cn(
                "flex h-full w-[300%] transition-transform duration-[220ms] ease-out motion-reduce:transition-none",
                offsets[level]
              )}
            >
              <SpecsPanel nav={nav} />
              <PrototypesPanel nav={nav} listRef={prototypesListRef} />
              <StatesPanel nav={nav} />
            </div>
          )}
        </SidebarContent>
      </nav>
      <SidebarRail />
    </Sidebar>
  );
}

function searchHits(registry: Registry, query: string) {
  const needle = query.trim().toLowerCase();
  const entries = registry.entries;
  return {
    flows: needle ? registry.flows.filter(flow => flowMatches(flow, query)) : [],
    prototypes: needle ? entries.filter(entry => matches(entry, query)) : [],
    states: needle
      ? entries.flatMap(entry =>
          entry.meta.states
            .filter(option => option.label.toLowerCase().includes(needle))
            .map(option => ({ entry, id: option.id, label: option.label }))
        )
      : [],
  };
}

function SearchField({
  nav,
  searchRef,
}: {
  nav: Nav;
  searchRef: RefObject<HTMLInputElement | null>;
}) {
  const hits = searchHits(nav.registry, nav.query);
  return (
    <label className="relative block shrink-0">
      <span className="sr-only">Search specs, prototypes, states and flows</span>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <SidebarInput
        ref={searchRef}
        value={nav.query}
        onChange={event => nav.onQuery(event.target.value)}
        onKeyDown={event => {
          if (event.key === "Escape") {
            nav.onQuery("");
            event.currentTarget.blur();
          }
          if (event.key !== "Enter") return;
          // Opens the first hit: a flow, then a prototype, then a state.
          const flow = hits.flows[0];
          const entry = hits.prototypes[0];
          const state = hits.states[0];
          const target: Selection | null = flow
            ? { kind: "flow", flow: flow.id }
            : entry
              ? { kind: "prototype", slug: entry.slug }
              : state
                ? { kind: "prototype", slug: state.entry.slug, state: state.id }
                : null;
          if (!target) return;
          event.preventDefault();
          select(target);
          nav.onQuery("");
          if (flow || (!entry && state)) nav.done();
        }}
        placeholder="Search prototypes and flows"
        className="h-9 border-transparent bg-card pr-9 pl-9 dark:bg-muted"
        data-testid="gallery-search"
      />
      <Kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 bg-muted font-mono">
        /
      </Kbd>
    </label>
  );
}

function SearchHits({ nav }: { nav: Nav }) {
  const hits = searchHits(nav.registry, nav.query);
  return (
    <SearchResults
      flows={hits.flows}
      activeFlow={nav.flow?.id ?? null}
      prototypes={hits.prototypes}
      states={hits.states}
      openOf={nav.openOf}
      onNavigate={() => nav.onQuery("")}
      onDone={() => {
        nav.onQuery("");
        nav.done();
      }}
    />
  );
}

function Problems({ registry }: { registry: Registry }) {
  if (registry.broken.length === 0 && registry.flowProblems.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 px-3 font-mono text-xs text-muted-foreground">
      {registry.broken.length > 0 ? <p>Not loaded: {registry.broken.join(", ")}</p> : null}
      {registry.flowProblems.length > 0 ? (
        <section aria-label="Flows with problems" data-testid="flow-problems">
          <p className="text-warning-foreground">
            {plural(registry.flowProblems.length, "flow problem")} (off the canvas until fixed):
          </p>
          <ul className="mt-1 flex flex-col gap-1">
            {registry.flowProblems.map(problem => (
              <li key={`${problem.file}:${problem.code}:${problem.node ?? ""}:${problem.message}`}>
                {problem.file}: {problem.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function SpecsPanel({ nav }: { nav: Nav }) {
  const { registry, level } = nav;
  return (
    <section
      className="flex h-full w-1/3 flex-col gap-3 px-3"
      inert={level !== "specs"}
      aria-label="Specs"
      data-testid="nav-specs"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-2">
        <RowGroup
          label="Specs"
          heading={<GroupHeading title="Specs" aside={registry.groups.length} />}
        >
          {registry.groups.map(item => (
            <SpecRow
              key={item.id}
              group={item}
              index={specPosition(registry, item.id)}
              active={item.id === nav.active}
              openComments={item.entries.reduce((sum, e) => sum + nav.openOf(e.slug), 0)}
            />
          ))}
        </RowGroup>
        <JourneyGroup
          registry={registry}
          activeFlow={nav.flow?.id ?? null}
          openOf={nav.openOf}
          onNavigate={nav.done}
        />
        <Problems registry={registry} />
      </div>
    </section>
  );
}

function PrototypesPanel({
  nav,
  listRef,
}: {
  nav: Nav;
  listRef: RefObject<HTMLDivElement | null>;
}) {
  const { group, level } = nav;
  return (
    <section
      className="flex h-full w-1/3 flex-col gap-3 px-3"
      inert={level !== "prototypes"}
      aria-label={group ? `Prototypes of ${group.title}` : "Prototypes"}
      data-testid="nav-prototypes"
    >
      <BackRow label="Specs" target={{ kind: "index" }} />
      {group ? <SpecLevel nav={nav} group={group} listRef={listRef} /> : null}
    </section>
  );
}

/** Level 2 of one spec: its flows, the flows crossing it and its screens. */
function SpecLevel({
  nav,
  group,
  listRef,
}: {
  nav: Nav;
  group: Group;
  listRef: RefObject<HTMLDivElement | null>;
}) {
  const { registry } = nav;
  const hasFlows = group.flows.length > 0 || group.crossing.length > 0;
  return (
    <>
      <LevelHeader eyebrow={specCode(registry, group)} title={group.title}>
        <span className="font-mono text-[11px] text-muted-foreground">
          {group.flows.length > 0 ? `${plural(group.flows.length, "flow")} · ` : ""}
          {plural(group.entries.length, "screen")}
        </span>
      </LevelHeader>
      <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pb-2">
        <SpecFlowGroups
          group={group}
          registry={registry}
          activeFlow={nav.flow?.id ?? null}
          openOf={nav.openOf}
          onNavigate={nav.done}
        />
        {group.entries.length > 0 ? (
          <RowGroup
            label="Screens"
            heading={
              hasFlows ? <GroupHeading title="Screens" aside={group.entries.length} /> : null
            }
          >
            {group.entries.map((entry, position) => (
              <PrototypeRow
                key={entry.slug}
                entry={entry}
                index={position}
                active={entry.slug === nav.current?.slug}
                openComments={nav.openOf(entry.slug)}
              />
            ))}
          </RowGroup>
        ) : null}
      </div>
    </>
  );
}

function StatesPanel({ nav }: { nav: Nav }) {
  const { current, level, group } = nav;
  const position = current && group ? group.entries.indexOf(current) : -1;
  const open = current ? nav.openOf(current.slug) : 0;
  return (
    <section
      className="flex h-full w-1/3 flex-col gap-3 px-3"
      inert={level !== "states"}
      aria-label={current ? `States of ${current.meta.title}` : "States"}
      data-testid="nav-states"
    >
      <BackRow
        label={group?.title ?? "Prototypes"}
        target={group ? { kind: "spec", spec: group.id } : { kind: "index" }}
      />
      {current ? (
        <>
          <LevelHeader
            eyebrow={`${position >= 0 ? `${ordinal(position)} · ` : ""}${current.meta.surface}`}
            title={current.meta.title}
          >
            <span className="font-mono text-[11px] break-all text-muted-foreground">
              {current.meta.route} · /{current.slug}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {plural(current.meta.states.length, "state")}
              {open === 1 ? " · 1 open comment" : ""}
              {open > 1 ? ` · ${open} open comments` : ""}
            </span>
          </LevelHeader>
          <StateList
            entry={current}
            registry={nav.registry}
            group={group}
            state={nav.state}
            comments={nav.comments}
            onNavigate={nav.done}
          />
        </>
      ) : null}
    </section>
  );
}
