/**
 * Canvas toolbar: sidebar trigger, prev/next and the breadcrumb (spec › page › state, each a
 * link), the spec's "Flows | Screens" segment and the state's flow membership ("In N flows"),
 * state, role (declared roles, or any configured role inside the app frame), viewport, theme and theme
 * comparison, comment mode and panel, open in a new tab, copy link (state, page or spec), help.
 */
import type { ComponentProps } from "react";
import { config } from "virtual:gallery-app";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Columns2Icon,
  ExternalLinkIcon,
  MessageSquareIcon,
  MessageSquarePlusIcon,
} from "@proto/ui/lib/icons";

import { Button } from "@proto/ui/components/button";
import { NativeSelect, NativeSelectOption } from "@proto/ui/components/native-select";
import { Separator } from "@proto/ui/components/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@proto/ui/components/tooltip";
import { cn } from "@proto/ui/lib/utils";
import { buttonVariants } from "@proto/ui/components/button";

import { commentsAvailable } from "./comments/api";
import { copyTargets, prototypeCrumbs } from "./crumbs";
import { SpecTabs } from "./flow-toolbar";
import { FlowMembership } from "./flows/membership";
import type { Entry, Group, Registry } from "./registry-model";
import { ShortcutsHelp } from "./shortcuts";
import { CopyLinkMenu, GallerySidebarTrigger, ThemeToggle, ViewHeading } from "./topbar";
import { roleOptionsFor, resolvePrototypeRole, select, updateView, type GalleryView } from "./view";
import { ViewportControl } from "./viewport-control";

type ToolbarProps = {
  entry: Entry;
  registry: Registry;
  /** Spec of the prototype, for the "Flows | Screens" segment. */
  group: Group | undefined;
  view: GalleryView;
  state: string;
  dark: boolean;
  shell: boolean;
  picking: boolean;
  openComments: number;
  helpOpen: boolean;
  onHelp: (open: boolean) => void;
  onPicking: (picking: boolean) => void;
  onStep: (direction: 1 | -1) => void;
  standaloneHref: string;
};

function IconAction({
  label,
  shortcut,
  children,
  ...props
}: ComponentProps<typeof Button> & { label: string; shortcut?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={label} {...props} />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut ? <span className="ml-1.5 font-mono opacity-70">{shortcut}</span> : null}
      </TooltipContent>
    </Tooltip>
  );
}

export function GalleryToolbar(props: ToolbarProps) {
  const { entry, view, state, dark } = props;
  const { meta } = entry;
  const roles = roleOptionsFor(meta.roles, config.roles);
  const selectedRole = resolvePrototypeRole(view.role, meta.roles, config.roles);
  const crumbs = prototypeCrumbs(props.group, entry, state);

  return (
    <header className="flex flex-col gap-2" data-testid="gallery-toolbar">
      <div className="flex min-h-10 items-center gap-1">
        <GallerySidebarTrigger />
        <IconAction label="Previous prototype" shortcut="K" onClick={() => props.onStep(-1)}>
          <ChevronLeftIcon />
        </IconAction>
        <IconAction label="Next prototype" shortcut="J" onClick={() => props.onStep(1)}>
          <ChevronRightIcon />
        </IconAction>
        <div className="ml-1 min-w-0 flex-1">
          <ViewHeading crumbs={crumbs} meta={`${meta.surface} · ${meta.route} · /${entry.slug}`} />
        </div>
        <Tooltip>
          <TooltipTrigger
            render={
              <a
                href={props.standaloneHref}
                target="_blank"
                rel="noreferrer"
                aria-label="Open in a new tab"
                className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
              />
            }
          >
            <ExternalLinkIcon />
          </TooltipTrigger>
          <TooltipContent>Open in a new tab</TooltipContent>
        </Tooltip>
        <CopyLinkMenu links={copyTargets(crumbs)} />
        <ShortcutsHelp open={props.helpOpen} onOpenChange={props.onHelp} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <SpecTabs group={props.group} active="screens" />
        <FlowMembership registry={props.registry} entry={entry} state={state} />
        {meta.states.length > 1 ? (
          <label className="flex items-center">
            <span className="sr-only">State</span>
            <NativeSelect
              size="sm"
              value={state}
              onChange={event =>
                select({ kind: "prototype", slug: entry.slug, state: event.target.value })
              }
              className="max-w-64"
              data-testid="state-select"
            >
              {meta.states.map((option, index) => (
                <NativeSelectOption key={option.id} value={option.id}>
                  {index + 1}. {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
        ) : null}
        {roles.length > 0 && (meta.roles || props.shell) ? (
          <label className="flex items-center">
            <span className="sr-only">Role</span>
            <NativeSelect
              size="sm"
              value={selectedRole ?? ""}
              onChange={event => updateView({ role: event.target.value || null })}
              data-testid="role-select"
            >
              {roles.map(option => (
                <NativeSelectOption key={option.label} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
        ) : null}

        <span className="flex-1" aria-hidden />
        <ViewportControl width={view.width} />

        <ThemeToggle dark={dark} />
        <IconAction
          label={view.compare ? "Stop comparing themes" : "Compare light and dark"}
          aria-pressed={view.compare}
          className={cn(view.compare && "bg-muted text-foreground")}
          onClick={() => updateView({ compare: !view.compare })}
        >
          <Columns2Icon />
        </IconAction>

        {commentsAvailable ? (
          <>
            <Separator orientation="vertical" className="mx-0.5 h-5" />
            <IconAction
              label={props.picking ? "Leave comment mode" : "Comment mode"}
              shortcut="C"
              aria-pressed={props.picking}
              disabled={view.compare}
              className={cn(
                props.picking && "bg-primary text-primary-foreground hover:bg-primary/85"
              )}
              onClick={() => props.onPicking(!props.picking)}
              data-testid="comment-mode"
            >
              <MessageSquarePlusIcon />
            </IconAction>
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={view.panel}
              className={cn("gap-1.5 font-mono", view.panel && "bg-muted text-foreground")}
              onClick={() => updateView({ panel: !view.panel, comment: null })}
              data-testid="comments-toggle"
            >
              <MessageSquareIcon />
              {props.openComments}
              <span className="sr-only">open comments</span>
            </Button>
          </>
        ) : null}
      </div>
    </header>
  );
}
