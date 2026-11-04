/**
 * A windowed tree (`_uiux.md` § New shared primitives): plain windowing over a flat list of
 * visible rows, so only the rows on screen (plus an overscan) are in the DOM whatever the size
 * of the tree. Fixed row height, no dependency. Keyboard: ↑/↓ move, → expands or enters, ←
 * collapses or goes to the parent, Home/End, Enter opens. Focus stays on the tree element and
 * follows `aria-activedescendant`.
 */
import {
  useEffectEvent,
  useId,
  useLayoutEffect,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { useBox } from "../lib/use-box";
import { cn } from "./utils";

export type VirtualTreeItem = {
  id: string;
  /** 1-based depth (`aria-level`). */
  level: number;
  /** Null for a leaf. */
  expanded: boolean | null;
  parent: string | null;
  position: number;
  size: number;
};

type VirtualTreeProps<Item extends VirtualTreeItem> = {
  label: string;
  items: readonly Item[];
  /** The row of the open page (`aria-selected`), scrolled into view when it changes. */
  selected: string | null;
  rowHeight?: number;
  overscan?: number;
  onToggle: (item: Item) => void;
  onOpen: (item: Item) => void;
  renderRow: (item: Item, state: { focused: boolean; selected: boolean }) => ReactNode;
  className?: string;
};

export function VirtualTree<Item extends VirtualTreeItem>({
  label,
  items,
  selected,
  rowHeight = 28,
  overscan = 8,
  onToggle,
  onOpen,
  renderRow,
  className,
}: VirtualTreeProps<Item>) {
  const prefix = useId();
  const [ref, box] = useBox();
  const [scrollTop, setScrollTop] = useState(0);
  const [focused, setFocused] = useState<string | null>(null);
  const indexOf = (id: string | null) =>
    id === null ? -1 : items.findIndex(item => item.id === id);
  const selectedIndex = indexOf(selected);
  const focusIndex = Math.max(0, indexOf(focused) >= 0 ? indexOf(focused) : selectedIndex);
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(items.length, Math.ceil((scrollTop + box.height) / rowHeight) + overscan);
  const rowId = (item: Item) => `${prefix}-${item.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

  /** Scroll the row at `index` into the viewport when it is outside it. */
  const reveal = (index: number) => {
    const element = ref.current;
    if (!element) return;
    const top = index * rowHeight;
    if (top < element.scrollTop) element.scrollTop = top;
    else if (top + rowHeight > element.scrollTop + element.clientHeight)
      element.scrollTop = top + rowHeight - element.clientHeight;
  };

  // A deep link or a page change: bring the open row into view.
  const revealSelected = useEffectEvent(() => {
    if (selectedIndex >= 0) reveal(selectedIndex);
  });
  useLayoutEffect(() => revealSelected(), [selected]);

  const moveTo = (index: number) => {
    const next = items[Math.min(items.length - 1, Math.max(0, index))];
    if (!next) return;
    setFocused(next.id);
    reveal(items.indexOf(next));
  };

  const current = items[focusIndex];
  const onKeyDown = (event: KeyboardEvent) => {
    if (!current) return;
    const handled = () => event.preventDefault();
    switch (event.key) {
      case "ArrowDown":
        handled();
        moveTo(focusIndex + 1);
        break;
      case "ArrowUp":
        handled();
        moveTo(focusIndex - 1);
        break;
      case "Home":
        handled();
        moveTo(0);
        break;
      case "End":
        handled();
        moveTo(items.length - 1);
        break;
      case "ArrowRight":
        handled();
        if (current.expanded === false) onToggle(current);
        else if (current.expanded === true) moveTo(focusIndex + 1);
        break;
      case "ArrowLeft":
        handled();
        if (current.expanded === true) onToggle(current);
        else if (current.parent !== null) moveTo(indexOf(current.parent));
        break;
      case "Enter":
        handled();
        onOpen(current);
        break;
    }
  };

  const rendered = current && focusIndex >= start && focusIndex < end;
  return (
    <div
      ref={ref}
      role="tree"
      aria-label={label}
      tabIndex={0}
      aria-activedescendant={rendered ? rowId(current) : undefined}
      onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
      onKeyDown={onKeyDown}
      className={cn(
        "relative min-h-0 overflow-y-auto outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset",
        className
      )}
    >
      <div role="none" className="relative w-full" style={{ height: items.length * rowHeight }}>
        {items.slice(start, end).map((item, offset) => {
          const index = start + offset;
          const isFocused = index === focusIndex;
          const isSelected = item.id === selected;
          return (
            <div
              key={item.id}
              id={rowId(item)}
              role="treeitem"
              aria-level={item.level}
              aria-expanded={item.expanded ?? undefined}
              aria-selected={isSelected}
              aria-setsize={item.size}
              aria-posinset={item.position}
              onClick={() => {
                setFocused(item.id);
                onOpen(item);
              }}
              className="absolute inset-x-0 flex items-center"
              style={{ top: index * rowHeight, height: rowHeight }}
            >
              {renderRow(item, { focused: isFocused, selected: isSelected })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
