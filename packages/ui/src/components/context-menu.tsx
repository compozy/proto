// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import * as React from "react";
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import { cn } from "@proto/ui/lib/utils";
import { CheckIcon, ChevronRightIcon } from "@proto/ui/lib/icons";

function ContextMenu({ ...props }: ContextMenuPrimitive.Root.Props) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />;
}

function ContextMenuPortal({ ...props }: ContextMenuPrimitive.Portal.Props) {
  return <ContextMenuPrimitive.Portal data-slot="context-menu-portal" {...props} />;
}

function ContextMenuTrigger({ className, ...props }: ContextMenuPrimitive.Trigger.Props) {
  return (
    <ContextMenuPrimitive.Trigger
      data-slot="context-menu-trigger"
      className={cn("defaults:select-none", className)}
      {...props}
    />
  );
}

function ContextMenuContent({
  className,
  align = "start",
  alignOffset = 4,
  side = "right",
  sideOffset = 0,
  ...props
}: ContextMenuPrimitive.Popup.Props &
  Pick<ContextMenuPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner
        className="defaults:isolate defaults:z-50 defaults:outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <ContextMenuPrimitive.Popup
          data-slot="context-menu-content"
          className={cn(
            "defaults:z-50 defaults:max-h-(--available-height) defaults:min-w-36 defaults:origin-(--transform-origin) defaults:overflow-x-hidden defaults:overflow-y-auto defaults:rounded-lg defaults:p-1 defaults:text-popover-foreground defaults:shadow-md defaults:ring-1 defaults:ring-foreground/10 defaults:duration-100 defaults:outline-none defaults:data-[side=bottom]:slide-in-from-top-2 defaults:data-[side=inline-end]:slide-in-from-left-2 defaults:data-[side=inline-start]:slide-in-from-right-2 defaults:data-[side=left]:slide-in-from-right-2 defaults:data-[side=right]:slide-in-from-left-2 defaults:data-[side=top]:slide-in-from-bottom-2 defaults:data-open:animate-in defaults:data-open:fade-in-0 defaults:data-open:zoom-in-95 defaults:data-closed:animate-out defaults:data-closed:fade-out-0 defaults:data-closed:zoom-out-95 defaults:animate-none! defaults:relative defaults:bg-popover/70 defaults:before:pointer-events-none defaults:before:absolute defaults:before:inset-0 defaults:before:-z-1 defaults:before:rounded-[inherit] defaults:before:backdrop-blur-2xl defaults:before:backdrop-saturate-150 defaults:**:data-[slot$=-item]:focus:bg-foreground/10 defaults:**:data-[slot$=-item]:data-highlighted:bg-foreground/10 defaults:**:data-[slot$=-separator]:bg-foreground/5 defaults:**:data-[slot$=-trigger]:focus:bg-foreground/10 defaults:**:data-[slot$=-trigger]:aria-expanded:bg-foreground/10! defaults:**:data-[variant=destructive]:focus:bg-foreground/10! defaults:**:data-[variant=destructive]:text-accent-foreground! defaults:**:data-[variant=destructive]:**:text-accent-foreground!",
            className
          )}
          {...props}
        />
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  );
}

function ContextMenuGroup({ ...props }: ContextMenuPrimitive.Group.Props) {
  return <ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />;
}

function ContextMenuLabel({
  className,
  inset,
  ...props
}: ContextMenuPrimitive.GroupLabel.Props & {
  inset?: boolean;
}) {
  return (
    <ContextMenuPrimitive.GroupLabel
      data-slot="context-menu-label"
      data-inset={inset}
      className={cn(
        "defaults:px-1.5 defaults:py-1 defaults:text-xs defaults:font-medium defaults:text-muted-foreground defaults:data-inset:pl-7",
        className
      )}
      {...props}
    />
  );
}

function ContextMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: ContextMenuPrimitive.Item.Props & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "group/context-menu-item defaults:relative defaults:flex defaults:cursor-default defaults:items-center defaults:gap-1.5 defaults:rounded-md defaults:px-1.5 defaults:py-1 defaults:text-sm defaults:outline-hidden defaults:select-none defaults:focus:bg-accent defaults:focus:text-accent-foreground defaults:data-inset:pl-7 defaults:data-[variant=destructive]:text-destructive defaults:data-[variant=destructive]:focus:bg-destructive/10 defaults:data-[variant=destructive]:focus:text-destructive defaults:dark:data-[variant=destructive]:focus:bg-destructive/20 defaults:data-disabled:pointer-events-none defaults:data-disabled:opacity-50 defaults:[&_svg]:pointer-events-none defaults:[&_svg]:shrink-0 defaults:[&_svg:not([class*='size-'])]:size-4 defaults:focus:*:[svg]:text-accent-foreground defaults:data-[variant=destructive]:*:[svg]:text-destructive",
        className
      )}
      {...props}
    />
  );
}

function ContextMenuSub({ ...props }: ContextMenuPrimitive.SubmenuRoot.Props) {
  return <ContextMenuPrimitive.SubmenuRoot data-slot="context-menu-sub" {...props} />;
}

function ContextMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: ContextMenuPrimitive.SubmenuTrigger.Props & {
  inset?: boolean;
}) {
  return (
    <ContextMenuPrimitive.SubmenuTrigger
      data-slot="context-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "defaults:flex defaults:cursor-default defaults:items-center defaults:gap-1.5 defaults:rounded-md defaults:px-1.5 defaults:py-1 defaults:text-sm defaults:outline-hidden defaults:select-none defaults:focus:bg-accent defaults:focus:text-accent-foreground defaults:data-inset:pl-7 defaults:data-open:bg-accent defaults:data-open:text-accent-foreground defaults:[&_svg]:pointer-events-none defaults:[&_svg]:shrink-0 defaults:[&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="defaults:rtl:rotate-180 defaults:ml-auto" />
    </ContextMenuPrimitive.SubmenuTrigger>
  );
}

function ContextMenuSubContent({ ...props }: React.ComponentProps<typeof ContextMenuContent>) {
  return (
    <ContextMenuContent
      data-slot="context-menu-sub-content"
      className="defaults:shadow-lg defaults:animate-none! defaults:relative defaults:bg-popover/70 defaults:before:pointer-events-none defaults:before:absolute defaults:before:inset-0 defaults:before:-z-1 defaults:before:rounded-[inherit] defaults:before:backdrop-blur-2xl defaults:before:backdrop-saturate-150 defaults:**:data-[slot$=-item]:focus:bg-foreground/10 defaults:**:data-[slot$=-item]:data-highlighted:bg-foreground/10 defaults:**:data-[slot$=-separator]:bg-foreground/5 defaults:**:data-[slot$=-trigger]:focus:bg-foreground/10 defaults:**:data-[slot$=-trigger]:aria-expanded:bg-foreground/10! defaults:**:data-[variant=destructive]:focus:bg-foreground/10! defaults:**:data-[variant=destructive]:text-accent-foreground! defaults:**:data-[variant=destructive]:**:text-accent-foreground!"
      side="right"
      {...props}
    />
  );
}

function ContextMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  ...props
}: ContextMenuPrimitive.CheckboxItem.Props & {
  inset?: boolean;
}) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      closeOnClick
      data-slot="context-menu-checkbox-item"
      data-inset={inset}
      className={cn(
        "defaults:relative defaults:flex defaults:cursor-default defaults:items-center defaults:gap-1.5 defaults:rounded-md defaults:py-1 defaults:pr-8 defaults:pl-1.5 defaults:text-sm defaults:outline-hidden defaults:select-none defaults:focus:bg-accent defaults:focus:text-accent-foreground defaults:data-inset:pl-7 defaults:data-disabled:pointer-events-none defaults:data-disabled:opacity-50 defaults:[&_svg]:pointer-events-none defaults:[&_svg]:shrink-0 defaults:[&_svg:not([class*='size-'])]:size-4",
        className
      )}
      checked={checked}
      {...props}
    >
      <span className="defaults:pointer-events-none defaults:absolute defaults:right-2">
        <ContextMenuPrimitive.CheckboxItemIndicator>
          <CheckIcon />
        </ContextMenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  );
}

function ContextMenuRadioGroup({ ...props }: ContextMenuPrimitive.RadioGroup.Props) {
  return <ContextMenuPrimitive.RadioGroup data-slot="context-menu-radio-group" {...props} />;
}

function ContextMenuRadioItem({
  className,
  children,
  inset,
  ...props
}: ContextMenuPrimitive.RadioItem.Props & {
  inset?: boolean;
}) {
  return (
    <ContextMenuPrimitive.RadioItem
      closeOnClick
      data-slot="context-menu-radio-item"
      data-inset={inset}
      className={cn(
        "defaults:relative defaults:flex defaults:cursor-default defaults:items-center defaults:gap-1.5 defaults:rounded-md defaults:py-1 defaults:pr-8 defaults:pl-1.5 defaults:text-sm defaults:outline-hidden defaults:select-none defaults:focus:bg-accent defaults:focus:text-accent-foreground defaults:data-inset:pl-7 defaults:data-disabled:pointer-events-none defaults:data-disabled:opacity-50 defaults:[&_svg]:pointer-events-none defaults:[&_svg]:shrink-0 defaults:[&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span className="defaults:pointer-events-none defaults:absolute defaults:right-2">
        <ContextMenuPrimitive.RadioItemIndicator>
          <CheckIcon />
        </ContextMenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.RadioItem>
  );
}

function ContextMenuSeparator({ className, ...props }: ContextMenuPrimitive.Separator.Props) {
  return (
    <ContextMenuPrimitive.Separator
      data-slot="context-menu-separator"
      className={cn("defaults:-mx-1 defaults:my-1 defaults:h-px defaults:bg-border", className)}
      {...props}
    />
  );
}

function ContextMenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="context-menu-shortcut"
      className={cn(
        "defaults:ml-auto defaults:text-xs defaults:tracking-widest defaults:text-muted-foreground defaults:group-focus/context-menu-item:text-accent-foreground",
        className
      )}
      {...props}
    />
  );
}

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
};
