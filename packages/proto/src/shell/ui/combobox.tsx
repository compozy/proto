// Vendored from @proto/ui (packages/ui/src/components/combobox.tsx @ 5e799db) for the prebuilt shell
// (ADR-002): imports point at ./utils and ./icons; never import @proto/ui from the shell.
// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import * as React from "react";
import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { cn } from "./utils";

import { Button } from "./button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "./input-group";
import { CheckIcon, ChevronDownIcon, XIcon } from "./icons";

const Combobox = ComboboxPrimitive.Root;

function ComboboxValue({ ...props }: ComboboxPrimitive.Value.Props) {
  return <ComboboxPrimitive.Value data-slot="combobox-value" {...props} />;
}

function ComboboxTrigger({ className, children, ...props }: ComboboxPrimitive.Trigger.Props) {
  return (
    <ComboboxPrimitive.Trigger
      data-slot="combobox-trigger"
      className={cn("defaults:[&_svg:not([class*='size-'])]:size-4", className)}
      {...props}
    >
      {children}
      <ChevronDownIcon className="defaults:pointer-events-none defaults:size-4 defaults:text-muted-foreground" />
    </ComboboxPrimitive.Trigger>
  );
}

function ComboboxClear({ className, ...props }: ComboboxPrimitive.Clear.Props) {
  return (
    <ComboboxPrimitive.Clear
      data-slot="combobox-clear"
      render={<InputGroupButton variant="ghost" size="icon-xs" />}
      className={cn(className)}
      {...props}
    >
      <XIcon className="defaults:pointer-events-none" />
    </ComboboxPrimitive.Clear>
  );
}

function ComboboxInput({
  className,
  children,
  disabled = false,
  showTrigger = true,
  showClear = false,
  ...props
}: ComboboxPrimitive.Input.Props & {
  showTrigger?: boolean;
  showClear?: boolean;
}) {
  return (
    <InputGroup className={cn("defaults:w-auto", className)}>
      <ComboboxPrimitive.Input render={<InputGroupInput disabled={disabled} />} {...props} />
      <InputGroupAddon align="inline-end">
        {showTrigger && (
          <InputGroupButton
            size="icon-xs"
            variant="ghost"
            render={<ComboboxTrigger />}
            data-slot="input-group-button"
            className="defaults:group-has-data-[slot=combobox-clear]/input-group:hidden defaults:data-pressed:bg-transparent"
            disabled={disabled}
          />
        )}
        {showClear && <ComboboxClear disabled={disabled} />}
      </InputGroupAddon>
      {children}
    </InputGroup>
  );
}

function ComboboxContent({
  className,
  side = "bottom",
  sideOffset = 6,
  align = "start",
  alignOffset = 0,
  anchor,
  ...props
}: ComboboxPrimitive.Popup.Props &
  Pick<
    ComboboxPrimitive.Positioner.Props,
    "side" | "align" | "sideOffset" | "alignOffset" | "anchor"
  >) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="defaults:isolate defaults:z-50"
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          data-chips={!!anchor}
          className={cn(
            "group/combobox-content defaults:max-h-(--available-height) defaults:w-(--anchor-width) defaults:max-w-(--available-width) defaults:min-w-[calc(var(--anchor-width)+--spacing(7))] defaults:origin-(--transform-origin) defaults:overflow-hidden defaults:rounded-lg defaults:text-popover-foreground defaults:shadow-md defaults:ring-1 defaults:ring-foreground/10 defaults:duration-100 defaults:data-[chips=true]:min-w-(--anchor-width) defaults:data-[side=bottom]:slide-in-from-top-2 defaults:data-[side=inline-end]:slide-in-from-left-2 defaults:data-[side=inline-start]:slide-in-from-right-2 defaults:data-[side=left]:slide-in-from-right-2 defaults:data-[side=right]:slide-in-from-left-2 defaults:data-[side=top]:slide-in-from-bottom-2 defaults:*:data-[slot=input-group]:m-1 defaults:*:data-[slot=input-group]:mb-0 defaults:*:data-[slot=input-group]:h-8 defaults:*:data-[slot=input-group]:border-input/30 defaults:*:data-[slot=input-group]:bg-input/30 defaults:*:data-[slot=input-group]:shadow-none defaults:data-open:animate-in defaults:data-open:fade-in-0 defaults:data-open:zoom-in-95 defaults:data-closed:animate-out defaults:data-closed:fade-out-0 defaults:data-closed:zoom-out-95 defaults:animate-none! defaults:relative defaults:bg-popover/70 defaults:before:pointer-events-none defaults:before:absolute defaults:before:inset-0 defaults:before:-z-1 defaults:before:rounded-[inherit] defaults:before:backdrop-blur-2xl defaults:before:backdrop-saturate-150 defaults:**:data-[slot$=-item]:focus:bg-foreground/10 defaults:**:data-[slot$=-item]:data-highlighted:bg-foreground/10 defaults:**:data-[slot$=-separator]:bg-foreground/5 defaults:**:data-[slot$=-trigger]:focus:bg-foreground/10 defaults:**:data-[slot$=-trigger]:aria-expanded:bg-foreground/10! defaults:**:data-[variant=destructive]:focus:bg-foreground/10! defaults:**:data-[variant=destructive]:text-accent-foreground! defaults:**:data-[variant=destructive]:**:text-accent-foreground!",
            className
          )}
          {...props}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}

function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={cn(
        "defaults:no-scrollbar defaults:max-h-[min(calc(--spacing(72)---spacing(9)),calc(var(--available-height)---spacing(9)))] defaults:scroll-py-1 defaults:overflow-y-auto defaults:overscroll-contain defaults:p-1 defaults:data-empty:p-0",
        className
      )}
      {...props}
    />
  );
}

function ComboboxItem({ className, children, ...props }: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        "defaults:relative defaults:flex defaults:w-full defaults:cursor-default defaults:items-center defaults:gap-2 defaults:rounded-md defaults:py-1 defaults:pr-8 defaults:pl-1.5 defaults:text-sm defaults:outline-hidden defaults:select-none defaults:data-highlighted:bg-accent defaults:data-highlighted:text-accent-foreground defaults:not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground defaults:data-disabled:pointer-events-none defaults:data-disabled:opacity-50 defaults:[&_svg]:pointer-events-none defaults:[&_svg]:shrink-0 defaults:[&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <ComboboxPrimitive.ItemIndicator
        render={
          <span className="defaults:pointer-events-none defaults:absolute defaults:right-2 defaults:flex defaults:size-4 defaults:items-center defaults:justify-center" />
        }
      >
        <CheckIcon className="defaults:pointer-events-none" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  );
}

function ComboboxGroup({ className, ...props }: ComboboxPrimitive.Group.Props) {
  return (
    <ComboboxPrimitive.Group data-slot="combobox-group" className={cn(className)} {...props} />
  );
}

function ComboboxLabel({ className, ...props }: ComboboxPrimitive.GroupLabel.Props) {
  return (
    <ComboboxPrimitive.GroupLabel
      data-slot="combobox-label"
      className={cn(
        "defaults:px-2 defaults:py-1.5 defaults:text-xs defaults:text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

function ComboboxCollection({ ...props }: ComboboxPrimitive.Collection.Props) {
  return <ComboboxPrimitive.Collection data-slot="combobox-collection" {...props} />;
}

function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={cn(
        "defaults:hidden defaults:w-full defaults:justify-center defaults:py-2 defaults:text-center defaults:text-sm defaults:text-muted-foreground defaults:group-data-empty/combobox-content:flex",
        className
      )}
      {...props}
    />
  );
}

function ComboboxSeparator({ className, ...props }: ComboboxPrimitive.Separator.Props) {
  return (
    <ComboboxPrimitive.Separator
      data-slot="combobox-separator"
      className={cn("defaults:-mx-1 defaults:my-1 defaults:h-px defaults:bg-border", className)}
      {...props}
    />
  );
}

function ComboboxChips({
  className,
  ...props
}: React.ComponentPropsWithRef<typeof ComboboxPrimitive.Chips> & ComboboxPrimitive.Chips.Props) {
  return (
    <ComboboxPrimitive.Chips
      data-slot="combobox-chips"
      className={cn(
        "defaults:flex defaults:min-h-8 defaults:flex-wrap defaults:items-center defaults:gap-1 defaults:rounded-lg defaults:border defaults:border-input defaults:bg-transparent defaults:bg-clip-padding defaults:px-2.5 defaults:py-1 defaults:text-sm defaults:transition-colors defaults:focus-within:border-ring defaults:focus-within:ring-3 defaults:focus-within:ring-ring/50 defaults:has-aria-invalid:border-destructive defaults:has-aria-invalid:ring-3 defaults:has-aria-invalid:ring-destructive/20 defaults:has-data-[slot=combobox-chip]:px-1 defaults:dark:bg-input/30 defaults:dark:has-aria-invalid:border-destructive/50 defaults:dark:has-aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  );
}

function ComboboxChip({
  className,
  children,
  showRemove = true,
  ...props
}: ComboboxPrimitive.Chip.Props & {
  showRemove?: boolean;
}) {
  return (
    <ComboboxPrimitive.Chip
      data-slot="combobox-chip"
      className={cn(
        "defaults:flex defaults:h-[calc(--spacing(5.25))] defaults:w-fit defaults:items-center defaults:justify-center defaults:gap-1 defaults:rounded-sm defaults:bg-muted defaults:px-1.5 defaults:text-xs defaults:font-medium defaults:whitespace-nowrap defaults:text-foreground defaults:has-disabled:pointer-events-none defaults:has-disabled:cursor-not-allowed defaults:has-disabled:opacity-50 defaults:has-data-[slot=combobox-chip-remove]:pr-0",
        className
      )}
      {...props}
    >
      {children}
      {showRemove && (
        <ComboboxPrimitive.ChipRemove
          render={<Button variant="ghost" size="icon-xs" />}
          className="defaults:-ml-1 defaults:opacity-50 defaults:hover:opacity-100"
          data-slot="combobox-chip-remove"
        >
          <XIcon className="defaults:pointer-events-none" />
        </ComboboxPrimitive.ChipRemove>
      )}
    </ComboboxPrimitive.Chip>
  );
}

function ComboboxChipsInput({ className, ...props }: ComboboxPrimitive.Input.Props) {
  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-chip-input"
      className={cn("defaults:min-w-16 defaults:flex-1 defaults:outline-none", className)}
      {...props}
    />
  );
}

function useComboboxAnchor() {
  return React.useRef<HTMLDivElement | null>(null);
}

export {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxGroup,
  ComboboxLabel,
  ComboboxCollection,
  ComboboxEmpty,
  ComboboxSeparator,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor,
};
