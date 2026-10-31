// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { cn } from "@proto/ui/lib/utils";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "@proto/ui/lib/icons";

const Select = SelectPrimitive.Root;

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("defaults:scroll-my-1 defaults:p-1", className)}
      {...props}
    />
  );
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("defaults:flex defaults:flex-1 defaults:text-left", className)}
      {...props}
    />
  );
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default";
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "defaults:flex defaults:w-fit defaults:items-center defaults:justify-between defaults:gap-1.5 defaults:rounded-lg defaults:border defaults:border-input defaults:bg-transparent defaults:py-2 defaults:pr-2 defaults:pl-2.5 defaults:text-sm defaults:whitespace-nowrap defaults:transition-colors defaults:outline-none defaults:select-none defaults:focus-visible:border-ring defaults:focus-visible:ring-3 defaults:focus-visible:ring-ring/50 defaults:disabled:cursor-not-allowed defaults:disabled:opacity-50 defaults:aria-invalid:border-destructive defaults:aria-invalid:ring-3 defaults:aria-invalid:ring-destructive/20 defaults:data-placeholder:text-muted-foreground defaults:data-[size=default]:h-8 defaults:data-[size=sm]:h-7 defaults:data-[size=sm]:rounded-[min(var(--radius-md),10px)] defaults:*:data-[slot=select-value]:line-clamp-1 defaults:*:data-[slot=select-value]:flex defaults:*:data-[slot=select-value]:items-center defaults:*:data-[slot=select-value]:gap-1.5 defaults:dark:bg-input/30 defaults:dark:hover:bg-input/50 defaults:dark:aria-invalid:border-destructive/50 defaults:dark:aria-invalid:ring-destructive/40 defaults:[&_svg]:pointer-events-none defaults:[&_svg]:shrink-0 defaults:[&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          <ChevronDownIcon className="defaults:pointer-events-none defaults:size-4 defaults:text-muted-foreground" />
        }
      >
        {null}
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="defaults:isolate defaults:z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn(
            "defaults:isolate defaults:z-50 defaults:max-h-(--available-height) defaults:w-(--anchor-width) defaults:min-w-36 defaults:origin-(--transform-origin) defaults:overflow-x-hidden defaults:overflow-y-auto defaults:rounded-lg defaults:text-popover-foreground defaults:shadow-md defaults:ring-1 defaults:ring-foreground/10 defaults:duration-100 defaults:data-[align-trigger=true]:animate-none defaults:data-[side=bottom]:slide-in-from-top-2 defaults:data-[side=inline-end]:slide-in-from-left-2 defaults:data-[side=inline-start]:slide-in-from-right-2 defaults:data-[side=left]:slide-in-from-right-2 defaults:data-[side=right]:slide-in-from-left-2 defaults:data-[side=top]:slide-in-from-bottom-2 defaults:data-open:animate-in defaults:data-open:fade-in-0 defaults:data-open:zoom-in-95 defaults:data-closed:animate-out defaults:data-closed:fade-out-0 defaults:data-closed:zoom-out-95 defaults:animate-none! defaults:relative defaults:bg-popover/70 defaults:before:pointer-events-none defaults:before:absolute defaults:before:inset-0 defaults:before:-z-1 defaults:before:rounded-[inherit] defaults:before:backdrop-blur-2xl defaults:before:backdrop-saturate-150 defaults:**:data-[slot$=-item]:focus:bg-foreground/10 defaults:**:data-[slot$=-item]:data-highlighted:bg-foreground/10 defaults:**:data-[slot$=-separator]:bg-foreground/5 defaults:**:data-[slot$=-trigger]:focus:bg-foreground/10 defaults:**:data-[slot$=-trigger]:aria-expanded:bg-foreground/10! defaults:**:data-[variant=destructive]:focus:bg-foreground/10! defaults:**:data-[variant=destructive]:text-accent-foreground! defaults:**:data-[variant=destructive]:**:text-accent-foreground!",
            className
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn(
        "defaults:px-1.5 defaults:py-1 defaults:text-xs defaults:text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "defaults:relative defaults:flex defaults:w-full defaults:cursor-default defaults:items-center defaults:gap-1.5 defaults:rounded-md defaults:py-1 defaults:pr-8 defaults:pl-1.5 defaults:text-sm defaults:outline-hidden defaults:select-none defaults:focus:bg-accent defaults:focus:text-accent-foreground defaults:not-data-[variant=destructive]:focus:**:text-accent-foreground defaults:data-disabled:pointer-events-none defaults:data-disabled:opacity-50 defaults:[&_svg]:pointer-events-none defaults:[&_svg]:shrink-0 defaults:[&_svg:not([class*='size-'])]:size-4 defaults:*:[span]:last:flex defaults:*:[span]:last:items-center defaults:*:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="defaults:flex defaults:flex-1 defaults:shrink-0 defaults:gap-2 defaults:whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="defaults:pointer-events-none defaults:absolute defaults:right-2 defaults:flex defaults:size-4 defaults:items-center defaults:justify-center" />
        }
      >
        <CheckIcon className="defaults:pointer-events-none" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({ className, ...props }: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn(
        "defaults:pointer-events-none defaults:-mx-1 defaults:my-1 defaults:h-px defaults:bg-border",
        className
      )}
      {...props}
    />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "defaults:top-0 defaults:z-10 defaults:flex defaults:w-full defaults:cursor-default defaults:items-center defaults:justify-center defaults:bg-popover defaults:py-1 defaults:[&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronUpIcon />
    </SelectPrimitive.ScrollUpArrow>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "defaults:bottom-0 defaults:z-10 defaults:flex defaults:w-full defaults:cursor-default defaults:items-center defaults:justify-center defaults:bg-popover defaults:py-1 defaults:[&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronDownIcon />
    </SelectPrimitive.ScrollDownArrow>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
