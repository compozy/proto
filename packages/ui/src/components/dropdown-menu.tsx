// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import * as React from "react";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { cn } from "@proto/ui/lib/utils";
import { CheckIcon, ChevronRightIcon } from "@proto/ui/lib/icons";

function DropdownMenu({ ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuPortal({ ...props }: MenuPrimitive.Portal.Props) {
  return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}

function DropdownMenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  className,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<MenuPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        className="defaults:isolate defaults:z-50 defaults:outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            "defaults:z-50 defaults:max-h-(--available-height) defaults:w-(--anchor-width) defaults:min-w-32 defaults:origin-(--transform-origin) defaults:overflow-x-hidden defaults:overflow-y-auto defaults:rounded-lg defaults:p-1 defaults:text-popover-foreground defaults:shadow-md defaults:ring-1 defaults:ring-foreground/10 defaults:duration-100 defaults:outline-none defaults:data-[side=bottom]:slide-in-from-top-2 defaults:data-[side=inline-end]:slide-in-from-left-2 defaults:data-[side=inline-start]:slide-in-from-right-2 defaults:data-[side=left]:slide-in-from-right-2 defaults:data-[side=right]:slide-in-from-left-2 defaults:data-[side=top]:slide-in-from-bottom-2 defaults:data-open:animate-in defaults:data-open:fade-in-0 defaults:data-open:zoom-in-95 defaults:data-closed:animate-out defaults:data-closed:overflow-hidden defaults:data-closed:fade-out-0 defaults:data-closed:zoom-out-95 defaults:animate-none! defaults:relative defaults:bg-popover/70 defaults:before:pointer-events-none defaults:before:absolute defaults:before:inset-0 defaults:before:-z-1 defaults:before:rounded-[inherit] defaults:before:backdrop-blur-2xl defaults:before:backdrop-saturate-150 defaults:**:data-[slot$=-item]:focus:bg-foreground/10 defaults:**:data-[slot$=-item]:data-highlighted:bg-foreground/10 defaults:**:data-[slot$=-separator]:bg-foreground/5 defaults:**:data-[slot$=-trigger]:focus:bg-foreground/10 defaults:**:data-[slot$=-trigger]:aria-expanded:bg-foreground/10! defaults:**:data-[variant=destructive]:focus:bg-foreground/10! defaults:**:data-[variant=destructive]:text-accent-foreground! defaults:**:data-[variant=destructive]:**:text-accent-foreground!",
            className
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

function DropdownMenuGroup({ ...props }: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: MenuPrimitive.GroupLabel.Props & {
  inset?: boolean;
}) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "defaults:px-1.5 defaults:py-1 defaults:text-xs defaults:font-medium defaults:text-muted-foreground defaults:data-inset:pl-7",
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: MenuPrimitive.Item.Props & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "group/dropdown-menu-item defaults:relative defaults:flex defaults:cursor-default defaults:items-center defaults:gap-1.5 defaults:rounded-md defaults:px-1.5 defaults:py-1 defaults:text-sm defaults:outline-hidden defaults:select-none defaults:focus:bg-accent defaults:focus:text-accent-foreground defaults:not-data-[variant=destructive]:focus:**:text-accent-foreground defaults:data-inset:pl-7 defaults:data-[variant=destructive]:text-destructive defaults:data-[variant=destructive]:focus:bg-destructive/10 defaults:data-[variant=destructive]:focus:text-destructive defaults:dark:data-[variant=destructive]:focus:bg-destructive/20 defaults:data-disabled:pointer-events-none defaults:data-disabled:opacity-50 defaults:[&_svg]:pointer-events-none defaults:[&_svg]:shrink-0 defaults:[&_svg:not([class*='size-'])]:size-4 defaults:data-[variant=destructive]:*:[svg]:text-destructive",
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
  return <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />;
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: MenuPrimitive.SubmenuTrigger.Props & {
  inset?: boolean;
}) {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "defaults:flex defaults:cursor-default defaults:items-center defaults:gap-1.5 defaults:rounded-md defaults:px-1.5 defaults:py-1 defaults:text-sm defaults:outline-hidden defaults:select-none defaults:focus:bg-accent defaults:focus:text-accent-foreground defaults:not-data-[variant=destructive]:focus:**:text-accent-foreground defaults:data-inset:pl-7 defaults:data-popup-open:bg-accent defaults:data-popup-open:text-accent-foreground defaults:data-open:bg-accent defaults:data-open:text-accent-foreground defaults:[&_svg]:pointer-events-none defaults:[&_svg]:shrink-0 defaults:[&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="defaults:rtl:rotate-180 defaults:ml-auto" />
    </MenuPrimitive.SubmenuTrigger>
  );
}

function DropdownMenuSubContent({
  align = "start",
  alignOffset = -3,
  side = "right",
  sideOffset = 0,
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        "defaults:w-auto defaults:min-w-[96px] defaults:rounded-lg defaults:p-1 defaults:text-popover-foreground defaults:shadow-lg defaults:ring-1 defaults:ring-foreground/10 defaults:duration-100 defaults:data-[side=bottom]:slide-in-from-top-2 defaults:data-[side=left]:slide-in-from-right-2 defaults:data-[side=right]:slide-in-from-left-2 defaults:data-[side=top]:slide-in-from-bottom-2 defaults:data-open:animate-in defaults:data-open:fade-in-0 defaults:data-open:zoom-in-95 defaults:data-closed:animate-out defaults:data-closed:fade-out-0 defaults:data-closed:zoom-out-95 defaults:animate-none! defaults:relative defaults:bg-popover/70 defaults:before:pointer-events-none defaults:before:absolute defaults:before:inset-0 defaults:before:-z-1 defaults:before:rounded-[inherit] defaults:before:backdrop-blur-2xl defaults:before:backdrop-saturate-150 defaults:**:data-[slot$=-item]:focus:bg-foreground/10 defaults:**:data-[slot$=-item]:data-highlighted:bg-foreground/10 defaults:**:data-[slot$=-separator]:bg-foreground/5 defaults:**:data-[slot$=-trigger]:focus:bg-foreground/10 defaults:**:data-[slot$=-trigger]:aria-expanded:bg-foreground/10! defaults:**:data-[variant=destructive]:focus:bg-foreground/10! defaults:**:data-[variant=destructive]:text-accent-foreground! defaults:**:data-[variant=destructive]:**:text-accent-foreground!",
        className
      )}
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  ...props
}: MenuPrimitive.CheckboxItem.Props & {
  inset?: boolean;
}) {
  return (
    <MenuPrimitive.CheckboxItem
      closeOnClick
      data-slot="dropdown-menu-checkbox-item"
      data-inset={inset}
      className={cn(
        "defaults:relative defaults:flex defaults:cursor-default defaults:items-center defaults:gap-1.5 defaults:rounded-md defaults:py-1 defaults:pr-8 defaults:pl-1.5 defaults:text-sm defaults:outline-hidden defaults:select-none defaults:focus:bg-accent defaults:focus:text-accent-foreground defaults:focus:**:text-accent-foreground defaults:data-inset:pl-7 defaults:data-disabled:pointer-events-none defaults:data-disabled:opacity-50 defaults:[&_svg]:pointer-events-none defaults:[&_svg]:shrink-0 defaults:[&_svg:not([class*='size-'])]:size-4",
        className
      )}
      checked={checked}
      {...props}
    >
      <span
        className="defaults:pointer-events-none defaults:absolute defaults:right-2 defaults:flex defaults:items-center defaults:justify-center"
        data-slot="dropdown-menu-checkbox-item-indicator"
      >
        <MenuPrimitive.CheckboxItemIndicator>
          <CheckIcon />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
  return <MenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

function DropdownMenuRadioItem({
  className,
  children,
  inset,
  ...props
}: MenuPrimitive.RadioItem.Props & {
  inset?: boolean;
}) {
  return (
    <MenuPrimitive.RadioItem
      closeOnClick
      data-slot="dropdown-menu-radio-item"
      data-inset={inset}
      className={cn(
        "defaults:relative defaults:flex defaults:cursor-default defaults:items-center defaults:gap-1.5 defaults:rounded-md defaults:py-1 defaults:pr-8 defaults:pl-1.5 defaults:text-sm defaults:outline-hidden defaults:select-none defaults:focus:bg-accent defaults:focus:text-accent-foreground defaults:focus:**:text-accent-foreground defaults:data-inset:pl-7 defaults:data-disabled:pointer-events-none defaults:data-disabled:opacity-50 defaults:[&_svg]:pointer-events-none defaults:[&_svg]:shrink-0 defaults:[&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span
        className="defaults:pointer-events-none defaults:absolute defaults:right-2 defaults:flex defaults:items-center defaults:justify-center"
        data-slot="dropdown-menu-radio-item-indicator"
      >
        <MenuPrimitive.RadioItemIndicator>
          <CheckIcon />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  );
}

function DropdownMenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("defaults:-mx-1 defaults:my-1 defaults:h-px defaults:bg-border", className)}
      {...props}
    />
  );
}

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "defaults:ml-auto defaults:text-xs defaults:tracking-widest defaults:text-muted-foreground defaults:group-focus/dropdown-menu-item:text-accent-foreground",
        className
      )}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
