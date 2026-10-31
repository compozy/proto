/**
 * Header pieces for flows: the "Flows | Screens" segment of a spec that owns flows and has
 * prototypes, and the flow header (sidebar trigger, breadcrumb down to the selected step, theme,
 * the flow's comments and side panel toggles, copy link of the step, flow or spec, shortcuts).
 * Prototype-only controls (state, width, comparison, comment mode) never show on a flow.
 */
import { MessageSquareIcon, PanelRightIcon } from "@proto/ui/lib/icons";

import { Button } from "@proto/ui/components/button";
import { Separator } from "@proto/ui/components/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@proto/ui/components/tooltip";
import { cn } from "@proto/ui/lib/utils";

import type { FlowEntry } from "../flow";
import { commentsAvailable } from "./comments/api";
import { copyTargets, flowCrumbs } from "./crumbs";
import { specTabs, type Group } from "./registry-model";
import { ShortcutsHelp } from "./shortcuts";
import { CopyLinkMenu, GallerySidebarTrigger, ThemeToggle, ViewHeading } from "./topbar";
import { plainClick, select, updateView, useSelectionHref, type Selection } from "./view";

const tabLabels = { flows: "Flows", screens: "Screens" } as const;

/** Links, not a toggle: each tab opens its spec's first flow or first prototype (history entry). */
export function SpecTabs({
  group,
  active,
}: {
  group: Group | undefined;
  active: "flows" | "screens";
}) {
  const hrefOf = useSelectionHref();
  const tabs = specTabs(group);
  const flow = group?.flows[0];
  const entry = group?.entries[0];
  if (tabs.length === 0 || !flow || !entry) return null;
  const targets: Record<"flows" | "screens", Selection> = {
    flows: { kind: "flow", flow: flow.id },
    screens: { kind: "prototype", slug: entry.slug },
  };
  return (
    <nav aria-label={`Views of ${group?.title ?? ""}`} className="flex rounded-lg bg-muted p-0.5">
      {tabs.map(tab => (
        <a
          key={tab}
          href={hrefOf(targets[tab])}
          aria-current={tab === active ? "page" : undefined}
          onClick={event => {
            if (!plainClick(event) || tab === active) return;
            select(targets[tab]);
          }}
          className="flex h-6 items-center rounded-md px-2.5 text-[12px] text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-[current]:bg-card aria-[current]:text-foreground"
          data-testid={`spec-tab-${tab}`}
        >
          {tabLabels[tab]}
        </a>
      ))}
    </nav>
  );
}

type FlowToolbarProps = {
  flow: FlowEntry;
  node: string | null;
  owner: Group | undefined;
  dark: boolean;
  openComments: number;
  /** Comments tab of the side panel (`?comments=1`). */
  panel: boolean;
  side: boolean;
  onSide: (open: boolean) => void;
  helpOpen: boolean;
  onHelp: (open: boolean) => void;
};

export function FlowToolbar(props: FlowToolbarProps) {
  const { flow, node, owner, dark, side } = props;
  const crumbs = flowCrumbs(owner, flow, node);
  return (
    <header
      className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2"
      data-testid="gallery-toolbar"
    >
      <div className="flex min-w-60 flex-1 items-center gap-1">
        <GallerySidebarTrigger />
        <div className="min-w-0 pl-1">
          <ViewHeading
            crumbs={crumbs}
            meta={`${flow.id} · ${flow.nodes.length} steps · ${flow.specs.length} ${
              flow.specs.length === 1 ? "spec" : "specs"
            }`}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <SpecTabs group={owner} active="flows" />
        <ThemeToggle dark={dark} />
        <Separator orientation="vertical" className="mx-0.5 h-5" />
        {commentsAvailable ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  aria-pressed={side && props.panel}
                  className={cn(
                    "gap-1.5 font-mono",
                    side && props.panel && "bg-muted text-foreground"
                  )}
                  onClick={() => {
                    const show = !(side && props.panel);
                    props.onSide(true);
                    updateView({ panel: show, comment: null });
                  }}
                  data-testid="comments-toggle"
                />
              }
            >
              <MessageSquareIcon />
              {props.openComments}
              <span className="sr-only">open comments</span>
            </TooltipTrigger>
            <TooltipContent>
              Flow comments
              <span className="ml-1.5 font-mono opacity-70">C</span>
            </TooltipContent>
          </Tooltip>
        ) : null}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-pressed={side}
                aria-label={side ? "Hide the flow panel" : "Show the flow panel"}
                className={cn("max-md:hidden", side && "bg-muted text-foreground")}
                onClick={() => props.onSide(!side)}
                data-testid="flow-side-toggle"
              />
            }
          >
            <PanelRightIcon />
          </TooltipTrigger>
          <TooltipContent>{side ? "Hide the flow panel" : "Show the flow panel"}</TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" className="mx-0.5 h-5" />
        <CopyLinkMenu links={copyTargets(crumbs)} />
        <ShortcutsHelp open={props.helpOpen} onOpenChange={props.onHelp} />
      </div>
    </header>
  );
}
