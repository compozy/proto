// Generated from shadcn base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
import * as React from "react";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@proto/ui/lib/utils";
import { ChevronRightIcon, MoreHorizontalIcon } from "@proto/ui/lib/icons";

function Breadcrumb({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav aria-label="breadcrumb" data-slot="breadcrumb" className={cn(className)} {...props} />
  );
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn(
        "defaults:flex defaults:flex-wrap defaults:items-center defaults:gap-1.5 defaults:text-sm defaults:wrap-break-word defaults:text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn("defaults:inline-flex defaults:items-center defaults:gap-1", className)}
      {...props}
    />
  );
}

function BreadcrumbLink({ className, render, ...props }: useRender.ComponentProps<"a">) {
  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(
      {
        className: cn("defaults:transition-colors defaults:hover:text-foreground", className),
      },
      props
    ),
    render,
    state: {
      slot: "breadcrumb-link",
    },
  });
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn("defaults:font-normal defaults:text-foreground", className)}
      {...props}
    />
  );
}

function BreadcrumbSeparator({ children, className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn("defaults:[&>svg]:size-3.5", className)}
      {...props}
    >
      {children ?? <ChevronRightIcon className="defaults:rtl:rotate-180" />}
    </li>
  );
}

function BreadcrumbEllipsis({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      className={cn(
        "defaults:flex defaults:size-5 defaults:items-center defaults:justify-center defaults:[&>svg]:size-4",
        className
      )}
      {...props}
    >
      <MoreHorizontalIcon />
      <span className="defaults:sr-only">More</span>
    </span>
  );
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
};
