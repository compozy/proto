/**
 * Flow rows of the sidebar: the global "Journeys" group (level 1), the spec level's "Spec flows"
 * and "Crossing this spec" groups (level 2) and flow search results. Every row is a
 * numbered link built with `selectionHref`, so plain and modified clicks land on the same URL.
 */
import { TriangleAlertIcon } from "@proto/ui/lib/icons";

import { SidebarMenuItem } from "@proto/ui/components/sidebar";

import type { FlowEntry } from "../flow";
import { flowWarnings, type Group, type Registry } from "./registry-model";
import { flowKey } from "../flow";
import { CommentDot, GroupHeading, NavLink, RowGroup, RowNumber } from "./sidebar-rows";

/** Open comments of a comment key (prototype slug or `flow-<id>`). */
type OpenOf = (key: string) => number;

export function FlowRow({
  flow,
  index,
  detail,
  active,
  warnings = 0,
  openComments = 0,
  onNavigate,
}: {
  flow: FlowEntry;
  /** Position in its list; search results have none. */
  index: number | null;
  detail: string;
  active: boolean;
  warnings?: number;
  openComments?: number;
  onNavigate?: () => void;
}) {
  return (
    <SidebarMenuItem data-flow={flow.id}>
      <NavLink
        target={{ kind: "flow", flow: flow.id }}
        active={active}
        onNavigate={onNavigate}
        data-testid="nav-flow"
      >
        {index === null ? null : <RowNumber index={index} />}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[14px] leading-snug group-aria-[current]/menu-button:font-medium">
            {flow.title}
          </span>
          <span className="truncate font-mono text-[11px] text-muted-foreground">{detail}</span>
        </span>
        {openComments > 0 ? (
          <span className="flex shrink-0 pt-0.5 font-mono text-[11px]">
            <CommentDot count={openComments} label="open comments" />
          </span>
        ) : null}
        {warnings > 0 ? (
          <span
            className="flex shrink-0 items-center gap-1 pt-0.5 font-mono text-[11px] text-warning-foreground"
            title={`${warnings} ${warnings === 1 ? "state" : "states"} in no flow`}
          >
            <TriangleAlertIcon className="size-3" aria-hidden />
            {warnings}
            <span className="sr-only">
              {warnings === 1 ? "warning" : "warnings"}: states in no flow
            </span>
          </span>
        ) : null}
      </NavLink>
    </SidebarMenuItem>
  );
}

const specCount = (flow: FlowEntry) =>
  `${flow.specs.length} ${flow.specs.length === 1 ? "spec" : "specs"}`;

/** Level 1: every flow of the product, by owner spec then title. */
export function JourneyGroup({
  registry,
  activeFlow,
  openOf,
  onNavigate,
}: {
  registry: Registry;
  activeFlow: string | null;
  openOf: OpenOf;
  onNavigate: () => void;
}) {
  if (registry.flows.length === 0) return null;
  return (
    <RowGroup
      label="Journeys"
      heading={<GroupHeading title="Journeys" aside="all specs" />}
      data-testid="nav-journeys"
    >
      {registry.flows.map((flow, index) => (
        <FlowRow
          key={flow.id}
          flow={flow}
          index={index}
          detail={`${flow.spec ?? "no spec"} · ${specCount(flow)}`}
          active={flow.id === activeFlow}
          openComments={openOf(flowKey(flow.id))}
          onNavigate={onNavigate}
        />
      ))}
    </RowGroup>
  );
}

/** Level 2: flows the spec owns, then flows owned elsewhere that cross it. */
export function SpecFlowGroups({
  group,
  registry,
  activeFlow,
  openOf,
  onNavigate,
}: {
  group: Group;
  registry: Registry;
  activeFlow: string | null;
  openOf: OpenOf;
  onNavigate: () => void;
}) {
  return (
    <>
      {group.flows.length > 0 ? (
        <RowGroup
          label="Spec flows"
          heading={<GroupHeading title="Spec flows" aside={group.flows.length} />}
        >
          {group.flows.map((flow, index) => (
            <FlowRow
              key={flow.id}
              flow={flow}
              index={index}
              detail={`${flow.nodes.length} steps · ${
                flow.specs.length > 1 ? `crosses ${specCount(flow)}` : "this spec only"
              }`}
              active={flow.id === activeFlow}
              warnings={flowWarnings(registry, flow).length}
              openComments={openOf(flowKey(flow.id))}
              onNavigate={onNavigate}
            />
          ))}
        </RowGroup>
      ) : null}
      {group.crossing.length > 0 ? (
        <RowGroup
          label="Crossing this spec"
          heading={<GroupHeading title="Crossing this spec" aside={group.crossing.length} />}
        >
          {group.crossing.map((flow, index) => (
            <FlowRow
              key={flow.id}
              flow={flow}
              index={index}
              detail={`${flow.spec ?? "no spec"} · ${flow.nodes.length} steps`}
              active={flow.id === activeFlow}
              openComments={openOf(flowKey(flow.id))}
              onNavigate={onNavigate}
            />
          ))}
        </RowGroup>
      ) : null}
    </>
  );
}

/** Flow matches of the sidebar search. */
export function FlowResults({
  flows,
  activeFlow,
  onNavigate,
}: {
  flows: FlowEntry[];
  activeFlow: string | null;
  onNavigate: () => void;
}) {
  if (flows.length === 0) return null;
  return (
    <RowGroup label="Flows found" heading={<GroupHeading title="Flows" />}>
      {flows.map(flow => (
        <FlowRow
          key={flow.id}
          flow={flow}
          index={null}
          detail={`${flow.spec ?? "no spec"} · ${flow.id}`}
          active={flow.id === activeFlow}
          onNavigate={onNavigate}
        />
      ))}
    </RowGroup>
  );
}
