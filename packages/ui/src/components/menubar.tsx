// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import * as React from "react";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { Menubar as MenubarPrimitive } from "@base-ui/react/menubar";
import { cn } from "@proto/ui/lib/utils";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@proto/ui/components/dropdown-menu";
import { CheckIcon } from "@proto/ui/lib/icons";

function Menubar({ className, ...props }: MenubarPrimitive.Props) {
  return (
    <MenubarPrimitive
      data-slot="menubar"
      className={cn(
        "defaults:flex defaults:h-8 defaults:items-center defaults:gap-0.5 defaults:rounded-lg defaults:border defaults:p-[3px]",
        className
      )}
      {...props}
    />
  );
}

function MenubarMenu({ ...props }: React.ComponentProps<typeof DropdownMenu>) {
  return <DropdownMenu data-slot="menubar-menu" {...props} />;
}

function MenubarGroup({ ...props }: React.ComponentProps<typeof DropdownMenuGroup>) {
  return <DropdownMenuGroup data-slot="menubar-group" {...props} />;
}

function MenubarPortal({ ...props }: React.ComponentProps<typeof DropdownMenuPortal>) {
  return <DropdownMenuPortal data-slot="menubar-portal" {...props} />;
}

function MenubarTrigger({ className, ...props }: React.ComponentProps<typeof DropdownMenuTrigger>) {
  return (
    <DropdownMenuTrigger
      data-slot="menubar-trigger"
      className={cn(
        "defaults:flex defaults:items-center defaults:rounded-sm defaults:px-1.5 defaults:py-[2px] defaults:text-sm defaults:font-medium defaults:outline-hidden defaults:select-none defaults:hover:bg-muted defaults:aria-expanded:bg-muted",
        className
      )}
      {...props}
    />
  );
}

function MenubarContent({
  className,
  align = "start",
  alignOffset = -4,
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      data-slot="menubar-content"
      align={align}
      alignOffset={alignOffset}
      sideOffset={sideOffset}
      className={cn(
        "defaults:cn-menu-translucent defaults:min-w-36 defaults:rounded-lg defaults:bg-popover defaults:p-1 defaults:text-popover-foreground defaults:shadow-md defaults:ring-1 defaults:ring-foreground/10 defaults:duration-100 defaults:data-[side=bottom]:slide-in-from-top-2 defaults:data-[side=inline-end]:slide-in-from-left-2 defaults:data-[side=inline-start]:slide-in-from-right-2 defaults:data-[side=left]:slide-in-from-right-2 defaults:data-[side=right]:slide-in-from-left-2 defaults:data-[side=top]:slide-in-from-bottom-2 defaults:data-open:animate-in defaults:data-open:fade-in-0 defaults:data-open:zoom-in-95",
        className
      )}
      {...props}
    />
  );
}

function MenubarItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuItem>) {
  return (
    <DropdownMenuItem
      data-slot="menubar-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "group/menubar-item defaults:gap-1.5 defaults:rounded-md defaults:px-1.5 defaults:py-1 defaults:text-sm defaults:focus:bg-accent defaults:focus:text-accent-foreground defaults:not-data-[variant=destructive]:focus:**:text-accent-foreground defaults:data-inset:pl-7 defaults:data-[variant=destructive]:text-destructive defaults:data-[variant=destructive]:focus:bg-destructive/10 defaults:data-[variant=destructive]:focus:text-destructive defaults:dark:data-[variant=destructive]:focus:bg-destructive/20 defaults:data-disabled:opacity-50 defaults:[&_svg:not([class*='size-'])]:size-4 defaults:data-[variant=destructive]:*:[svg]:text-destructive!",
        className
      )}
      {...props}
    />
  );
}

function MenubarCheckboxItem({
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
      data-slot="menubar-checkbox-item"
      data-inset={inset}
      className={cn(
        "defaults:relative defaults:flex defaults:cursor-default defaults:items-center defaults:gap-1.5 defaults:rounded-md defaults:py-1 defaults:pr-1.5 defaults:pl-7 defaults:text-sm defaults:outline-hidden defaults:select-none defaults:focus:bg-accent defaults:focus:text-accent-foreground defaults:focus:**:text-accent-foreground defaults:data-inset:pl-7 defaults:data-disabled:pointer-events-none defaults:data-disabled:opacity-50 defaults:[&_svg]:pointer-events-none defaults:[&_svg]:shrink-0",
        className
      )}
      checked={checked}
      {...props}
    >
      <span className="defaults:pointer-events-none defaults:absolute defaults:left-1.5 defaults:flex defaults:size-4 defaults:items-center defaults:justify-center defaults:[&_svg:not([class*='size-'])]:size-4">
        <MenuPrimitive.CheckboxItemIndicator>
          <CheckIcon />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

function MenubarRadioGroup({ ...props }: React.ComponentProps<typeof DropdownMenuRadioGroup>) {
  return <DropdownMenuRadioGroup data-slot="menubar-radio-group" {...props} />;
}

function MenubarRadioItem({
  className,
  children,
  inset,
  ...props
}: MenuPrimitive.RadioItem.Props & {
  inset?: boolean;
}) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="menubar-radio-item"
      data-inset={inset}
      className={cn(
        "defaults:relative defaults:flex defaults:cursor-default defaults:items-center defaults:gap-1.5 defaults:rounded-md defaults:py-1 defaults:pr-1.5 defaults:pl-7 defaults:text-sm defaults:outline-hidden defaults:select-none defaults:focus:bg-accent defaults:focus:text-accent-foreground defaults:focus:**:text-accent-foreground defaults:data-inset:pl-7 defaults:data-disabled:pointer-events-none defaults:data-disabled:opacity-50 defaults:[&_svg]:pointer-events-none defaults:[&_svg]:shrink-0 defaults:[&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span className="defaults:pointer-events-none defaults:absolute defaults:left-1.5 defaults:flex defaults:size-4 defaults:items-center defaults:justify-center defaults:[&_svg:not([class*='size-'])]:size-4">
        <MenuPrimitive.RadioItemIndicator>
          <CheckIcon />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  );
}

function MenubarLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuLabel> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuLabel
      data-slot="menubar-label"
      data-inset={inset}
      className={cn(
        "defaults:px-1.5 defaults:py-1 defaults:text-sm defaults:font-medium defaults:data-inset:pl-7",
        className
      )}
      {...props}
    />
  );
}

function MenubarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuSeparator>) {
  return (
    <DropdownMenuSeparator
      data-slot="menubar-separator"
      className={cn("defaults:-mx-1 defaults:my-1 defaults:h-px defaults:bg-border", className)}
      {...props}
    />
  );
}

function MenubarShortcut({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuShortcut>) {
  return (
    <DropdownMenuShortcut
      data-slot="menubar-shortcut"
      className={cn(
        "defaults:ml-auto defaults:text-xs defaults:tracking-widest defaults:text-muted-foreground defaults:group-focus/menubar-item:text-accent-foreground",
        className
      )}
      {...props}
    />
  );
}

function MenubarSub({ ...props }: React.ComponentProps<typeof DropdownMenuSub>) {
  return <DropdownMenuSub data-slot="menubar-sub" {...props} />;
}

function MenubarSubTrigger({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuSubTrigger> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuSubTrigger
      data-slot="menubar-sub-trigger"
      data-inset={inset}
      className={cn(
        "defaults:gap-1.5 defaults:rounded-md defaults:px-1.5 defaults:py-1 defaults:text-sm defaults:focus:bg-accent defaults:focus:text-accent-foreground defaults:data-inset:pl-7 defaults:data-open:bg-accent defaults:data-open:text-accent-foreground defaults:[&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  );
}

function MenubarSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuSubContent>) {
  return (
    <DropdownMenuSubContent
      data-slot="menubar-sub-content"
      className={cn(
        "defaults:cn-menu-translucent defaults:min-w-32 defaults:rounded-lg defaults:bg-popover defaults:p-1 defaults:text-popover-foreground defaults:shadow-lg defaults:ring-1 defaults:ring-foreground/10 defaults:duration-100 defaults:data-[side=bottom]:slide-in-from-top-2 defaults:data-[side=left]:slide-in-from-right-2 defaults:data-[side=right]:slide-in-from-left-2 defaults:data-[side=top]:slide-in-from-bottom-2 defaults:data-open:animate-in defaults:data-open:fade-in-0 defaults:data-open:zoom-in-95 defaults:data-closed:animate-out defaults:data-closed:fade-out-0 defaults:data-closed:zoom-out-95",
        className
      )}
      {...props}
    />
  );
}

export {
  Menubar,
  MenubarPortal,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarGroup,
  MenubarSeparator,
  MenubarLabel,
  MenubarItem,
  MenubarShortcut,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
};
