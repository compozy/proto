// Generated from ReUI base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import { Autocomplete as AutocompletePrimitive } from "@base-ui/react/autocomplete";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@proto/ui/lib/utils";
import { ScrollArea } from "@proto/ui/components/scroll-area";
import { ChevronsUpDownIcon, XIcon } from "@proto/ui/lib/icons";

const inputVariants = cva(
  "defaults:outline-none defaults:flex defaults:w-full defaults:text-foreground defaults:placeholder:text-muted-foreground defaults:disabled:pointer-events-none defaults:disabled:cursor-not-allowed defaults:disabled:opacity-50 defaults:[[readonly]]:bg-muted/80 defaults:[[readonly]]:cursor-not-allowed defaults:border defaults:border-input defaults:focus-visible:border-ring defaults:aria-invalid:ring-destructive/20 defaults:dark:aria-invalid:ring-destructive/40 defaults:aria-invalid:border-destructive defaults:dark:aria-invalid:border-destructive/50 defaults:rounded-lg defaults:bg-transparent defaults:dark:bg-input/30 defaults:text-sm defaults:transition-colors defaults:focus-visible:ring-ring/50 defaults:focus-visible:ring-3 defaults:aria-invalid:ring-3",
  {
    variants: {
      size: {
        sm: "defaults:h-7 defaults:px-2 defaults:[&~[data-slot=autocomplete-clear]]:end-1.5 defaults:[&~[data-slot=autocomplete-trigger]]:end-1.5",
        default:
          "defaults:h-8 defaults:px-2.5 defaults:[&~[data-slot=autocomplete-clear]]:end-1.75 defaults:[&~[data-slot=autocomplete-trigger]]:end-1.75",
        lg: "defaults:h-9 defaults:px-2.5 defaults:[&~[data-slot=autocomplete-clear]]:end-2 defaults:[&~[data-slot=autocomplete-trigger]]:end-2",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

const Autocomplete = AutocompletePrimitive.Root;

function AutocompleteValue({ ...props }: AutocompletePrimitive.Value.Props) {
  return <AutocompletePrimitive.Value data-slot="autocomplete-value" {...props} />;
}

function AutocompleteInput({
  className,
  size = "default",
  showClear = false,
  showTrigger = false,
  ...props
}: Omit<AutocompletePrimitive.Input.Props, "size"> &
  VariantProps<typeof inputVariants> & {
    showClear?: boolean;
    showTrigger?: boolean;
  }) {
  return (
    <div className="defaults:relative defaults:w-full">
      <AutocompletePrimitive.Input
        data-slot="autocomplete-input"
        data-size={size}
        className={cn(inputVariants({ size }), className)}
        {...props}
      />
      {showTrigger && <AutocompleteTrigger />}
      {showClear && <AutocompleteClear />}
    </div>
  );
}

function AutocompleteStatus({ className, ...props }: AutocompletePrimitive.Status.Props) {
  return (
    <AutocompletePrimitive.Status
      data-slot="autocomplete-status"
      className={cn(
        "defaults:text-muted-foreground defaults:px-2 defaults:py-1.5 defaults:text-sm defaults:empty:m-0 defaults:empty:p-0",
        className
      )}
      {...props}
    />
  );
}

function AutocompletePortal({ ...props }: AutocompletePrimitive.Portal.Props) {
  return <AutocompletePrimitive.Portal data-slot="autocomplete-portal" {...props} />;
}

function AutocompleteBackdrop({ ...props }: AutocompletePrimitive.Backdrop.Props) {
  return <AutocompletePrimitive.Backdrop data-slot="autocomplete-backdrop" {...props} />;
}

function AutocompletePositioner({ className, ...props }: AutocompletePrimitive.Positioner.Props) {
  return (
    <AutocompletePrimitive.Positioner
      data-slot="autocomplete-positioner"
      className={cn("defaults:z-50 defaults:outline-none", className)}
      {...props}
    />
  );
}

function AutocompleteList({
  className,
  scrollAreaClassName,
  ...props
}: AutocompletePrimitive.List.Props & {
  scrollAreaClassName?: string;
  scrollFade?: boolean;
  scrollbarGutter?: boolean;
}) {
  // Out of the layout while the list renders nothing. Base UI's scroll area
  // skips measuring 0px tall content, so a list that overflowed and then
  // filtered to empty kept its old thumb, hanging below the popup. Keyed on
  // :empty, not data-empty, which a list without `items` always carries.
  return (
    <ScrollArea
      className={cn(
        "defaults:size-full defaults:min-h-0 defaults:has-[[data-slot=autocomplete-list]:empty]:hidden defaults:**:data-[slot=scroll-area-viewport]:h-full defaults:**:data-[slot=scroll-area-viewport]:overscroll-contain",
        scrollAreaClassName
      )}
    >
      <AutocompletePrimitive.List
        data-slot="autocomplete-list"
        className={cn(
          "defaults:not-empty:px-1 defaults:not-empty:py-1 defaults:not-empty:scroll-py-1 defaults:in-data-has-overflow-y:me-3",
          className
        )}
        {...props}
      />
    </ScrollArea>
  );
}

function AutocompleteCollection({
  ...props
}: React.ComponentProps<typeof AutocompletePrimitive.Collection>) {
  return <AutocompletePrimitive.Collection data-slot="autocomplete-collection" {...props} />;
}

function AutocompleteRow({
  className,
  ...props
}: React.ComponentProps<typeof AutocompletePrimitive.Row>) {
  return (
    <AutocompletePrimitive.Row
      data-slot="autocomplete-row"
      className={cn("defaults:flex defaults:items-center defaults:gap-2", className)}
      {...props}
    />
  );
}

function AutocompleteItem({
  className,
  ...props
}: React.ComponentProps<typeof AutocompletePrimitive.Item>) {
  return (
    <AutocompletePrimitive.Item
      data-slot="autocomplete-item"
      className={cn(
        "defaults:text-foreground defaults:data-highlighted:text-foreground defaults:data-highlighted:before:bg-accent defaults:gap-1.5",
        "defaults:rounded-md",
        "defaults:data-highlighted:before:rounded-md",
        /* Icon sizing mirrors the shadcn Select item. Rhea tracks nova, as its
           shadcn Input metrics match nova's; the row radius above follows the
           shadcn Select and Dropdown Menu items, xl in rhea. */
        "defaults:px-1.5 defaults:py-1 defaults:text-sm defaults:[&_svg:not([class*='size-'])]:size-4 defaults:relative defaults:flex defaults:cursor-default defaults:items-center defaults:outline-hidden defaults:transition-colors defaults:select-none defaults:data-disabled:pointer-events-none defaults:data-disabled:opacity-50 defaults:data-highlighted:relative defaults:data-highlighted:z-0 defaults:data-highlighted:before:absolute defaults:data-highlighted:before:inset-x-0 defaults:data-highlighted:before:inset-y-0 defaults:data-highlighted:before:z-[-1] defaults:[&_svg]:pointer-events-none defaults:[&_svg]:shrink-0 defaults:[&_svg:not([role=img]):not([class*=text-])]:opacity-60",
        className
      )}
      {...props}
    />
  );
}

export interface AutocompleteContentProps extends React.ComponentProps<
  typeof AutocompletePrimitive.Popup
> {
  align?: AutocompletePrimitive.Positioner.Props["align"];
  sideOffset?: AutocompletePrimitive.Positioner.Props["sideOffset"];
  alignOffset?: AutocompletePrimitive.Positioner.Props["alignOffset"];
  side?: AutocompletePrimitive.Positioner.Props["side"];
  anchor?: AutocompletePrimitive.Positioner.Props["anchor"];
  showBackdrop?: boolean;
}

function AutocompleteContent({
  className,
  children,
  showBackdrop = false,
  align = "start",
  sideOffset = 4,
  alignOffset = 0,
  side = "bottom",
  anchor,
  ...props
}: AutocompleteContentProps) {
  return (
    <AutocompletePortal>
      {showBackdrop && <AutocompleteBackdrop />}
      <AutocompletePositioner
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        side={side}
        anchor={anchor}
      >
        <div className="defaults:relative defaults:flex defaults:max-h-full">
          <AutocompletePrimitive.Popup
            data-slot="autocomplete-popup"
            className={cn(
              "defaults:bg-popover defaults:text-popover-foreground defaults:rounded-lg defaults:shadow-md defaults:ring-foreground/10 defaults:flex defaults:max-h-[min(var(--available-height),24rem)] defaults:w-(--anchor-width) defaults:max-w-(--available-width) defaults:origin-(--transform-origin) defaults:scroll-pt-2 defaults:scroll-pb-2 defaults:flex-col defaults:overscroll-contain defaults:py-0.5 defaults:ring-1 defaults:transition-[scale,opacity] defaults:has-data-starting-style:scale-98 defaults:has-data-starting-style:opacity-0 defaults:has-data-[side=none]:scale-100 defaults:has-data-[side=none]:transition-none",
              className
            )}
            {...props}
          >
            {children}
          </AutocompletePrimitive.Popup>
        </div>
      </AutocompletePositioner>
    </AutocompletePortal>
  );
}

function AutocompleteGroup({ ...props }: React.ComponentProps<typeof AutocompletePrimitive.Group>) {
  return <AutocompletePrimitive.Group data-slot="autocomplete-group" {...props} />;
}

function AutocompleteGroupLabel({
  className,
  ...props
}: React.ComponentProps<typeof AutocompletePrimitive.GroupLabel>) {
  return (
    <AutocompletePrimitive.GroupLabel
      data-slot="autocomplete-group-label"
      className={cn(
        "defaults:text-muted-foreground defaults:px-1.5 defaults:py-1 defaults:text-xs defaults:font-medium",
        className
      )}
      {...props}
    />
  );
}

function AutocompleteEmpty({
  className,
  ...props
}: React.ComponentProps<typeof AutocompletePrimitive.Empty>) {
  return (
    <AutocompletePrimitive.Empty
      data-slot="autocomplete-empty"
      className={cn(
        "defaults:text-muted-foreground defaults:px-2 defaults:py-1.5 defaults:text-sm defaults:text-center defaults:empty:m-0 defaults:empty:p-0",
        className
      )}
      {...props}
    />
  );
}

function AutocompleteClear({
  className,
  ...props
}: React.ComponentProps<typeof AutocompletePrimitive.Clear>) {
  return (
    <AutocompletePrimitive.Clear
      data-slot="autocomplete-clear"
      className={cn(
        "defaults:ring-offset-background defaults:focus:ring-ring defaults:absolute defaults:top-1/2 defaults:-translate-y-1/2 defaults:cursor-pointer defaults:opacity-70 defaults:transition-opacity defaults:hover:opacity-100 defaults:focus:ring-2 defaults:focus:ring-offset-2 defaults:focus:outline-none defaults:disabled:pointer-events-none defaults:data-disabled:pointer-events-none",
        className
      )}
      {...props}
    >
      <XIcon className="defaults:size-4" />
    </AutocompletePrimitive.Clear>
  );
}

function AutocompleteTrigger({
  className,
  ...props
}: React.ComponentProps<typeof AutocompletePrimitive.Trigger>) {
  return (
    <AutocompletePrimitive.Trigger
      data-slot="autocomplete-trigger"
      className={cn(
        "defaults:focus:ring-ring defaults:ring-offset-background defaults:absolute defaults:top-1/2 defaults:-translate-y-1/2 defaults:cursor-pointer defaults:focus:ring-2 defaults:focus:ring-offset-2 defaults:focus:outline-none defaults:disabled:pointer-events-none defaults:has-[+[data-slot=autocomplete-clear]]:hidden defaults:data-disabled:pointer-events-none",
        className
      )}
      {...props}
    >
      <ChevronsUpDownIcon className="defaults:size-4 defaults:opacity-70" />
    </AutocompletePrimitive.Trigger>
  );
}

function AutocompleteArrow({ ...props }: React.ComponentProps<typeof AutocompletePrimitive.Arrow>) {
  return <AutocompletePrimitive.Arrow data-slot="autocomplete-arrow" {...props} />;
}

function AutocompleteSeparator({
  className,
  ...props
}: React.ComponentProps<typeof AutocompletePrimitive.Separator>) {
  return (
    <AutocompletePrimitive.Separator
      data-slot="autocomplete-separator"
      className={cn("defaults:bg-border defaults:my-1.5 defaults:h-px", className)}
      {...props}
    />
  );
}

export {
  Autocomplete,
  AutocompleteValue,
  AutocompleteTrigger,
  AutocompleteInput,
  AutocompleteStatus,
  AutocompletePortal,
  AutocompleteBackdrop,
  AutocompletePositioner,
  AutocompleteContent,
  AutocompleteList,
  AutocompleteCollection,
  AutocompleteRow,
  AutocompleteItem,
  AutocompleteGroup,
  AutocompleteGroupLabel,
  AutocompleteEmpty,
  AutocompleteClear,
  AutocompleteArrow,
  AutocompleteSeparator,
};
