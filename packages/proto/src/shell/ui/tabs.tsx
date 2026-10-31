// Vendored from @proto/ui (packages/ui/src/components/tabs.tsx @ 5e799db) for the prebuilt shell
// (ADR-002): imports point at ./utils and ./icons; never import @proto/ui from the shell.
// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils";

function Tabs({ className, orientation = "horizontal", ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "group/tabs defaults:flex defaults:gap-2 defaults:data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "group/tabs-list defaults:inline-flex defaults:w-fit defaults:items-center defaults:justify-center defaults:rounded-lg defaults:p-[3px] defaults:text-muted-foreground defaults:group-data-horizontal/tabs:h-8 defaults:group-data-vertical/tabs:h-fit defaults:group-data-vertical/tabs:flex-col defaults:data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "defaults:bg-muted",
        line: "defaults:gap-1 defaults:bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function TabsList({
  className,
  variant = "default",
  activateOnFocus = true,
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      activateOnFocus={activateOnFocus}
      data-activate-on-focus={activateOnFocus}
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "defaults:relative defaults:inline-flex defaults:h-[calc(100%-1px)] defaults:flex-1 defaults:items-center defaults:justify-center defaults:gap-1.5 defaults:rounded-md defaults:border defaults:border-transparent defaults:px-1.5 defaults:py-0.5 defaults:text-sm defaults:font-medium defaults:whitespace-nowrap defaults:text-foreground/60 defaults:transition-all defaults:group-data-vertical/tabs:w-full defaults:group-data-vertical/tabs:justify-start defaults:hover:text-foreground defaults:focus-visible:border-ring defaults:focus-visible:ring-[3px] defaults:focus-visible:ring-ring/50 defaults:focus-visible:outline-1 defaults:focus-visible:outline-ring defaults:disabled:pointer-events-none defaults:disabled:opacity-50 defaults:has-data-[icon=inline-end]:pr-1 defaults:has-data-[icon=inline-start]:pl-1 defaults:aria-disabled:pointer-events-none defaults:aria-disabled:opacity-50 defaults:dark:text-muted-foreground defaults:dark:hover:text-foreground defaults:group-data-[variant=default]/tabs-list:data-active:shadow-sm defaults:group-data-[variant=line]/tabs-list:data-active:shadow-none defaults:[&_svg]:pointer-events-none defaults:[&_svg]:shrink-0 defaults:[&_svg:not([class*='size-'])]:size-4",
        "defaults:group-data-[variant=line]/tabs-list:bg-transparent defaults:group-data-[variant=line]/tabs-list:data-active:bg-transparent defaults:dark:group-data-[variant=line]/tabs-list:data-active:border-transparent defaults:dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "defaults:data-active:bg-background defaults:data-active:text-foreground defaults:dark:data-active:border-input defaults:dark:data-active:bg-input/30 defaults:dark:data-active:text-foreground",
        "defaults:after:absolute defaults:after:bg-foreground defaults:after:opacity-0 defaults:after:transition-opacity defaults:group-data-horizontal/tabs:after:inset-x-0 defaults:group-data-horizontal/tabs:after:bottom-[-5px] defaults:group-data-horizontal/tabs:after:h-0.5 defaults:group-data-vertical/tabs:after:inset-y-0 defaults:group-data-vertical/tabs:after:-right-1 defaults:group-data-vertical/tabs:after:w-0.5 defaults:group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("defaults:flex-1 defaults:text-sm defaults:outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
