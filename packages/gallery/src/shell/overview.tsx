/**
 * The two levels above a page: the specs index (`/`) and a spec overview (`?spec=`). Both are
 * shareable views of numbered links, so a reviewer can send "this spec" or "these screens" and the
 * other person lands on the same list: the spec's flows, the flows that cross it, and every screen
 * with its states.
 */
import type { ReactNode } from "react";
import { ChevronRightIcon, WorkflowIcon } from "@proto/ui/lib/icons";

import { Badge } from "@proto/ui/components/badge";
import { cn } from "@proto/ui/lib/utils";

import type { FlowEntry } from "../flow";
import type { CommentCounts } from "./comments/model";
import { copyTargets, indexCrumb, specCrumb } from "./crumbs";
import {
  flowWarnings,
  specPosition,
  specSlug,
  type Entry,
  type Group,
  type Registry,
} from "./registry-model";
import { ShortcutsHelp } from "./shortcuts";
import { ordinal, plural, specCode } from "./sidebar-model";
import { CopyLinkMenu, GallerySidebarTrigger, ThemeToggle, ViewHeading } from "./topbar";
import { plainClick, select, useSelectionHref, type Selection } from "./view";

type OverviewProps = {
  registry: Registry;
  counts: CommentCounts;
  dark: boolean;
  helpOpen: boolean;
  onHelp: (open: boolean) => void;
};

function Link({
  target,
  className,
  children,
  ...props
}: {
  target: Selection;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
  "data-testid"?: string;
}) {
  const hrefOf = useSelectionHref();
  return (
    <a
      href={hrefOf(target)}
      onClick={event => {
        if (plainClick(event)) select(target);
      }}
      className={cn(
        "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      {...props}
    >
      {children}
    </a>
  );
}

function OverviewBar({
  crumbs,
  meta,
  dark,
  helpOpen,
  onHelp,
}: Pick<OverviewProps, "dark" | "helpOpen" | "onHelp"> & {
  crumbs: Parameters<typeof ViewHeading>[0]["crumbs"];
  meta: ReactNode;
}) {
  const links = copyTargets(crumbs);
  return (
    <header className="flex min-h-12 items-center gap-2" data-testid="gallery-toolbar">
      <GallerySidebarTrigger />
      <div className="min-w-0 flex-1 pl-1">
        <ViewHeading crumbs={crumbs} meta={meta} />
      </div>
      <ThemeToggle dark={dark} />
      {links.length > 0 ? <CopyLinkMenu links={links} /> : null}
      <ShortcutsHelp open={helpOpen} onOpenChange={onHelp} />
    </header>
  );
}

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <h2 className="flex items-baseline justify-between font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
        <span>{title}</span>
        {aside ? <span className="font-normal tracking-normal normal-case">{aside}</span> : null}
      </h2>
      {children}
    </section>
  );
}

function CommentCount({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="flex items-center gap-1 font-mono text-[11px] text-primary dark:text-accent-foreground">
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {count}
      <span className="sr-only">{count === 1 ? "open comment" : "open comments"}</span>
    </span>
  );
}

function FlowCard({ flow, index, warnings }: { flow: FlowEntry; index: number; warnings: number }) {
  return (
    <li>
      <Link
        target={{ kind: "flow", flow: flow.id }}
        className="flex h-full items-start gap-3 rounded-[14px] bg-muted p-4 hover:bg-accent"
        data-testid="overview-flow"
      >
        <span className="font-mono text-[11px] text-muted-foreground">{ordinal(index)}</span>
        <WorkflowIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[14px] leading-snug">{flow.title}</span>
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {flow.id} · {plural(flow.nodes.length, "step")} ·{" "}
            {flow.specs.length > 1 ? `crosses ${flow.specs.length} specs` : "this spec only"}
            {warnings > 0 ? ` · ${plural(warnings, "warning")}` : ""}
          </span>
        </span>
      </Link>
    </li>
  );
}

function ScreenCard({ entry, index, open }: { entry: Entry; index: number; open: number }) {
  const { meta } = entry;
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-[14px] bg-muted p-4" data-slug={entry.slug}>
      <Link
        target={{ kind: "prototype", slug: entry.slug }}
        className="-m-1 flex items-start gap-3 rounded-[10px] p-1 hover:bg-accent"
        data-testid="overview-screen"
      >
        <span className="pt-0.5 font-mono text-[11px] text-muted-foreground">{ordinal(index)}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-2 text-[14px] leading-snug">
            <span className="font-mono text-xs text-primary dark:text-accent-foreground">
              {meta.surface}
            </span>
            <span className="truncate">{meta.title}</span>
            {entry.kind === "draft" ? <Badge variant="secondary">Draft</Badge> : null}
          </span>
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {meta.route} · /{entry.slug}
          </span>
        </span>
        <CommentCount count={open} />
      </Link>
      <ol className="flex min-w-0 flex-wrap gap-1.5" aria-label={`States of ${meta.title}`}>
        {meta.states.map((option, position) => (
          <li key={option.id} className="min-w-0 max-w-full">
            <Link
              target={{ kind: "prototype", slug: entry.slug, state: option.id }}
              className="flex h-7 max-w-full items-center gap-1.5 rounded-[10px] bg-background px-2 text-[12px] text-muted-foreground hover:text-foreground"
              data-testid="overview-state"
            >
              <span className="font-mono text-[10.5px]">{ordinal(position)}</span>
              <span className="truncate">{option.label}</span>
            </Link>
          </li>
        ))}
      </ol>
    </li>
  );
}

function SpecCard({
  registry,
  group,
  counts,
}: {
  registry: Registry;
  group: Group;
  counts: CommentCounts;
}) {
  const position = specPosition(registry, group.id);
  const states = group.entries.reduce((sum, entry) => sum + entry.meta.states.length, 0);
  const open = group.entries.reduce((sum, entry) => sum + (counts[entry.slug]?.open ?? 0), 0);
  return (
    <li>
      <Link
        target={{ kind: "spec", spec: group.id }}
        className="flex h-full items-start gap-3 rounded-[14px] bg-muted p-4 hover:bg-accent"
        data-testid="overview-spec"
      >
        <span className="w-5 pt-0.5 font-mono text-[11px] text-muted-foreground">
          {position === null ? "" : ordinal(position)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[15px] leading-snug">{group.title}</span>
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {specSlug(group)}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {plural(group.flows.length, "flow")} · {plural(group.entries.length, "screen")} ·{" "}
            {plural(states, "state")}
          </span>
        </span>
        <span className="flex items-center gap-2 pt-0.5">
          <CommentCount count={open} />
          <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
        </span>
      </Link>
    </li>
  );
}

function Body({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto rounded-[20px] bg-card p-5 md:p-8"
      data-testid="overview"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-8">{children}</div>
    </div>
  );
}

export function IndexOverview(props: OverviewProps) {
  const { registry, counts } = props;
  return (
    <>
      <OverviewBar
        {...props}
        crumbs={[indexCrumb]}
        meta={`${plural(registry.groups.length, "spec")} · ${plural(registry.flows.length, "flow")} · ${plural(registry.entries.length, "screen")}`}
      />
      <Body>
        <Section title="Specs" aside={registry.groups.length}>
          <ul className="grid gap-3 md:grid-cols-2">
            {registry.groups.map(group => (
              <SpecCard key={group.id} registry={registry} group={group} counts={counts} />
            ))}
          </ul>
        </Section>
        {registry.flows.length > 0 ? (
          <Section title="Journeys" aside="all specs">
            <ul className="grid gap-3 md:grid-cols-2">
              {registry.flows.map((flow, index) => (
                <FlowCard
                  key={flow.id}
                  flow={flow}
                  index={index}
                  warnings={flowWarnings(registry, flow).length}
                />
              ))}
            </ul>
          </Section>
        ) : null}
      </Body>
    </>
  );
}

export function SpecOverview(props: OverviewProps & { group: Group }) {
  const { registry, counts, group } = props;
  return (
    <>
      <OverviewBar
        {...props}
        crumbs={[indexCrumb, specCrumb(group)]}
        meta={`${specCode(registry, group)} · ${plural(group.flows.length, "flow")} · ${plural(
          group.entries.length,
          "screen"
        )}`}
      />
      <Body>
        {group.flows.length > 0 ? (
          <Section title="Spec flows" aside={group.flows.length}>
            <ul className="grid gap-3 md:grid-cols-2">
              {group.flows.map((flow, index) => (
                <FlowCard
                  key={flow.id}
                  flow={flow}
                  index={index}
                  warnings={flowWarnings(registry, flow).length}
                />
              ))}
            </ul>
          </Section>
        ) : null}
        {group.crossing.length > 0 ? (
          <Section title="Crossing this spec" aside={group.crossing.length}>
            <ul className="grid gap-3 md:grid-cols-2">
              {group.crossing.map((flow, index) => (
                <FlowCard key={flow.id} flow={flow} index={index} warnings={0} />
              ))}
            </ul>
          </Section>
        ) : null}
        {group.entries.length > 0 ? (
          <Section title="Screens" aside={group.entries.length}>
            <ul className="grid gap-3 lg:grid-cols-2">
              {group.entries.map((entry, index) => (
                <ScreenCard
                  key={entry.slug}
                  entry={entry}
                  index={index}
                  open={counts[entry.slug]?.open ?? 0}
                />
              ))}
            </ul>
          </Section>
        ) : null}
      </Body>
    </>
  );
}
