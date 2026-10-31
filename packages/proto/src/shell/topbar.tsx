/**
 * Shared top bar pieces of every gallery view: the sidebar trigger, the breadcrumb (each level is
 * a link to its own view) and the "copy link" menu, which copies the link of any level on screen
 * (state, page, spec; step, flow, spec).
 */
import { Fragment, type ReactNode } from "react";
import { LinkIcon, MoonIcon, SunIcon } from "@proto/ui/lib/icons";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@proto/ui/components/breadcrumb";
import { Button } from "@proto/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@proto/ui/components/dropdown-menu";
import { SidebarTrigger } from "@proto/ui/components/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@proto/ui/components/tooltip";
import { cn } from "@proto/ui/lib/utils";
import { toast } from "@proto/ui/components/toast";

import {
  plainClick,
  select,
  selectionUrl,
  useSelectionHref,
  updateView,
  type Selection,
} from "./view";

export type Crumb = { label: string; detail?: string; target: Selection };

export function GallerySidebarTrigger() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <SidebarTrigger aria-label="Show or hide the sidebar" data-testid="sidebar-trigger" />
        }
      />
      <TooltipContent>
        Show or hide the sidebar
        <span className="ml-1.5 font-mono opacity-70">⌘B</span>
      </TooltipContent>
    </Tooltip>
  );
}

export function ThemeToggle({ dark }: { dark: boolean }) {
  const label = dark ? "Use light theme" : "Use dark theme";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            onClick={() => updateView({ theme: dark ? "light" : "dark" })}
          />
        }
      >
        {dark ? <SunIcon /> : <MoonIcon />}
      </TooltipTrigger>
      <TooltipContent>
        {label}
        <span className="ml-1.5 font-mono opacity-70">T</span>
      </TooltipContent>
    </Tooltip>
  );
}

/** Breadcrumb of the view; the last crumb is the page itself, the others link to their view. */
function GalleryBreadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  const hrefOf = useSelectionHref();
  return (
    <Breadcrumb className="min-w-0" aria-label="Breadcrumb">
      <BreadcrumbList className="flex-nowrap gap-1 text-[13px]">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <Fragment key={`${crumb.target.kind}:${crumb.label}`}>
              <BreadcrumbItem className={cn("min-w-0", !last && "max-md:hidden")}>
                {last ? (
                  <BreadcrumbPage className="truncate">
                    <h1 className="truncate text-[15px] font-medium">{crumb.label}</h1>
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    className="truncate"
                    render={
                      <a
                        href={hrefOf(crumb.target)}
                        onClick={event => {
                          if (plainClick(event)) select(crumb.target);
                        }}
                      />
                    }
                  >
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {last ? null : <BreadcrumbSeparator className="max-md:hidden" />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/** Title block of a view: breadcrumb plus a mono line of identifiers. */
export function ViewHeading({ crumbs, meta }: { crumbs: Crumb[]; meta: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col">
      <GalleryBreadcrumb crumbs={crumbs} />
      <span className="truncate font-mono text-[11px] text-muted-foreground">{meta}</span>
    </div>
  );
}

function copy(url: string, label: string) {
  void navigator.clipboard.writeText(url).then(
    () => toast.add({ title: "Link copied", description: label }),
    () => toast.add({ title: "Could not copy the link", type: "error" })
  );
}

/** Copies the link of one level of what is on screen, from the deepest to the widest. */
export function CopyLinkMenu({ links }: { links: Crumb[] }) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Copy link"
                  data-testid="copy-link"
                />
              }
            />
          }
        >
          <LinkIcon />
        </TooltipTrigger>
        <TooltipContent>Copy link</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Copy link to</DropdownMenuLabel>
          {links.map(link => (
            <DropdownMenuItem
              key={`${link.target.kind}:${link.label}`}
              onClick={() => copy(selectionUrl(link.target), link.label)}
              className="items-start py-1.5"
              data-testid={`copy-link-${link.target.kind}`}
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[13px]">{link.label}</span>
                {link.detail ? (
                  <span className="truncate font-mono text-[11px] text-muted-foreground">
                    {link.detail}
                  </span>
                ) : null}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
