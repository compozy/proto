// Generated from ReUI base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { createContext, useContext } from "react";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type { ItemInstance } from "@headless-tree/core";

import { cn } from "@proto/ui/lib/utils";
import { ChevronDownIcon, MinusIcon, PlusIcon } from "@proto/ui/lib/icons";

type ToggleIconType = "chevron" | "plus-minus";

interface TreeContextValue<T = any> {
  indent: number;
  currentItem?: ItemInstance<T>;
  tree?: any;
  toggleIconType?: ToggleIconType;
}

const TreeContext = createContext<TreeContextValue>({
  indent: 20,
  currentItem: undefined,
  tree: undefined,
  toggleIconType: "plus-minus",
});

function useTreeContext<T = any>() {
  return useContext(TreeContext) as TreeContextValue<T>;
}

interface TreeProps extends React.HTMLAttributes<HTMLDivElement> {
  indent?: number;
  tree?: any;
  toggleIconType?: ToggleIconType;
}

function Tree({ indent = 20, tree, className, toggleIconType = "chevron", ...props }: TreeProps) {
  const containerProps =
    tree && typeof tree.getContainerProps === "function" ? tree.getContainerProps() : {};
  const mergedProps = { ...props, ...containerProps };

  // Extract style from mergedProps to merge with our custom styles
  const { style: propStyle, ...otherProps } = mergedProps;

  // Merge styles
  const mergedStyle = {
    ...propStyle,
    "--tree-indent": `${indent}px`,
  } as React.CSSProperties;

  return (
    <TreeContext.Provider value={{ indent, tree, toggleIconType }}>
      <div
        data-slot="tree"
        style={mergedStyle}
        className={cn("defaults:flex defaults:flex-col", className)}
        {...otherProps}
      />
    </TreeContext.Provider>
  );
}

interface TreeItemProps<T = any> extends Omit<useRender.ComponentProps<"button">, "indent"> {
  item: ItemInstance<T>;
  indent?: number;
}

function TreeItem<T = any>({ item, className, render, children, ...props }: TreeItemProps<T>) {
  const parentContext = useTreeContext<T>();
  const { indent } = parentContext;

  const itemProps = typeof item.getProps === "function" ? item.getProps() : {};
  const mergedProps = { ...props, children, ...itemProps };

  // Extract style from mergedProps to merge with our custom styles
  const { style: propStyle, ...otherProps } = mergedProps;

  // Merge styles
  const mergedStyle = {
    ...propStyle,
    "--tree-padding": `${item.getItemMeta().level * indent}px`,
  } as React.CSSProperties;

  const defaultProps = {
    "data-slot": "tree-item",
    style: mergedStyle,
    className: cn(
      "defaults:z-10 defaults:ps-(--tree-padding) defaults:outline-hidden defaults:select-none defaults:not-last:pb-0.5 defaults:focus:z-20 defaults:data-[disabled]:pointer-events-none defaults:data-[disabled]:opacity-50",
      className
    ),
    "data-focus": typeof item.isFocused === "function" ? item.isFocused() || false : undefined,
    "data-folder": typeof item.isFolder === "function" ? item.isFolder() || false : undefined,
    "data-selected": typeof item.isSelected === "function" ? item.isSelected() || false : undefined,
    "data-drag-target":
      typeof item.isDragTarget === "function" ? item.isDragTarget() || false : undefined,
    "data-search-match":
      typeof item.isMatchingSearch === "function" ? item.isMatchingSearch() || false : undefined,
    "aria-expanded": item.isExpanded(),
  };

  return (
    <TreeContext.Provider value={{ ...parentContext, currentItem: item }}>
      {useRender({
        defaultTagName: "button",
        render,
        props: mergeProps<"button">(defaultProps, otherProps),
      })}
    </TreeContext.Provider>
  );
}

interface TreeItemLabelProps<T = any> extends React.HTMLAttributes<HTMLSpanElement> {
  item?: ItemInstance<T>;
}

function TreeItemLabel<T = any>({
  item: propItem,
  children,
  className,
  ...props
}: TreeItemLabelProps<T>) {
  const { currentItem, toggleIconType } = useTreeContext<T>();
  const item = propItem || currentItem;

  if (!item) {
    console.warn("TreeItemLabel: No item provided via props or context");
    return null;
  }

  return (
    <span
      data-slot="tree-item-label"
      className={cn(
        "defaults:in-focus-visible:ring-ring/50 defaults:bg-background defaults:hover:bg-accent defaults:in-data-[selected=true]:bg-accent defaults:in-data-[selected=true]:text-accent-foreground defaults:in-data-[drag-target=true]:bg-accent defaults:flex defaults:items-center defaults:gap-1 defaults:transition-colors defaults:not-in-data-[folder=true]:ps-7 defaults:in-focus-visible:ring-[3px] defaults:in-data-[search-match=true]:bg-blue-50! defaults:[&_svg]:pointer-events-none defaults:[&_svg]:shrink-0",
        "defaults:rounded-md",
        "defaults:py-1.5",
        "defaults:px-2",
        "defaults:text-sm",
        className
      )}
      {...props}
    >
      {item.isFolder() &&
        (toggleIconType === "plus-minus" ? (
          item.isExpanded() ? (
            <MinusIcon
              className="defaults:text-muted-foreground defaults:size-3.5"
              stroke="currentColor"
              strokeWidth="1"
            />
          ) : (
            <PlusIcon
              className="defaults:text-muted-foreground defaults:size-3.5"
              stroke="currentColor"
              strokeWidth="1"
            />
          )
        ) : (
          <ChevronDownIcon className="defaults:text-muted-foreground defaults:size-4 defaults:in-aria-[expanded=false]:-rotate-90" />
        ))}
      {children || (typeof item.getItemName === "function" ? item.getItemName() : null)}
    </span>
  );
}

function TreeDragLine({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { tree } = useTreeContext();

  if (!tree || typeof tree.getDragLineStyle !== "function") {
    console.warn(
      "TreeDragLine: No tree provided via context or tree does not have getDragLineStyle method"
    );
    return null;
  }

  const dragLine = tree.getDragLineStyle();
  return (
    <div
      style={dragLine}
      className={cn(
        "defaults:bg-primary defaults:before:bg-background defaults:before:border-primary defaults:absolute defaults:z-30 defaults:-mt-px defaults:h-0.5 defaults:w-[unset] defaults:before:absolute defaults:before:-top-[3px] defaults:before:left-0 defaults:before:size-2 defaults:before:border-2",
        "defaults:before:rounded-full",
        className
      )}
      {...props}
    />
  );
}

export { Tree, TreeItem, TreeItemLabel, TreeDragLine };
