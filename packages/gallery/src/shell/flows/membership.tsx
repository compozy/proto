/**
 * Prototype toolbar "In N flows" (N = distinct flows using the state on screen): a menu with
 * every occurrence (flow and "step X of Y"), each opening the flow with that node selected.
 * "In no flow" when the state is in none, with "Other states in flows" when other states of
 * the prototype are; no menu at all when nothing of the prototype is in a flow.
 */
import { ChevronDownIcon, WorkflowIcon } from "@proto/ui/lib/icons";

import { Button } from "@proto/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@proto/ui/components/dropdown-menu";

import type { Occurrence } from "../../flow";
import { flowCount } from "../../flow-graph";
import { flowById, occurrencesOf, type Entry, type Registry } from "../registry-model";
import { plainClick, select, useSelectionHref } from "../view";

function OccurrenceItem({
  registry,
  occurrence,
  detail,
}: {
  registry: Registry;
  occurrence: Occurrence;
  detail?: string;
}) {
  const hrefOf = useSelectionHref();
  const target = { kind: "flow", flow: occurrence.flow, node: occurrence.node } as const;
  const title = flowById(registry, occurrence.flow)?.title ?? occurrence.flow;
  const position = `step ${occurrence.step} of ${occurrence.steps}`;
  return (
    <DropdownMenuItem
      render={
        <a
          aria-label={[title, detail, position].filter(Boolean).join(", ")}
          href={hrefOf(target)}
          onClick={event => {
            if (plainClick(event)) select(target);
          }}
        />
      }
      className="flex-col items-start gap-0 rounded-[10px] px-2.5 py-1.5"
    >
      <span className="text-[13px]">{title}</span>
      {detail ? <span className="text-[12px] text-muted-foreground">{detail}</span> : null}
      <span className="font-mono text-[11px] text-muted-foreground">{position}</span>
    </DropdownMenuItem>
  );
}

export function FlowMembership({
  registry,
  entry,
  state,
}: {
  registry: Registry;
  entry: Entry;
  state: string;
}) {
  const here = occurrencesOf(registry, entry.slug, state);
  const others = entry.meta.states
    .filter(option => option.id !== state)
    .flatMap(option =>
      occurrencesOf(registry, entry.slug, option.id).map(occurrence => ({ option, occurrence }))
    );
  const count = flowCount(here);
  const label = count === 0 ? "In no flow" : `In ${count} ${count === 1 ? "flow" : "flows"}`;

  if (here.length === 0 && others.length === 0) {
    return (
      <span
        className="flex h-7 items-center gap-1.5 px-2 text-[12px] text-muted-foreground"
        data-testid="flow-membership"
      >
        <WorkflowIcon className="size-3.5" aria-hidden />
        {label}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground aria-expanded:text-foreground"
            data-testid="flow-membership"
          />
        }
      >
        <WorkflowIcon aria-hidden />
        {label}
        <ChevronDownIcon className="size-3.5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 rounded-[14px] bg-popover p-1.5 shadow-none ring-0 before:hidden"
      >
        {here.length > 0 ? (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-2.5 font-mono text-[10px] tracking-[0.08em] uppercase">
              This state appears in
            </DropdownMenuLabel>
            {here.map(occurrence => (
              <OccurrenceItem
                key={`${occurrence.flow}:${occurrence.node}`}
                registry={registry}
                occurrence={occurrence}
              />
            ))}
          </DropdownMenuGroup>
        ) : null}
        {here.length > 0 && others.length > 0 ? <DropdownMenuSeparator /> : null}
        {others.length > 0 ? (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-2.5 font-mono text-[10px] tracking-[0.08em] uppercase">
              Other states in flows
            </DropdownMenuLabel>
            {others.map(({ option, occurrence }) => (
              <OccurrenceItem
                key={`${option.id}:${occurrence.flow}:${occurrence.node}`}
                registry={registry}
                occurrence={occurrence}
                detail={option.label}
              />
            ))}
          </DropdownMenuGroup>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
