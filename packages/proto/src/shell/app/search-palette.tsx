/** S13 ⌘K search: prototypes, states, flows, comments and actions, ranked (UT-025). */
import { useId, useState } from "react";

import { useT, type Translate } from "../lib/i18n";
import { go } from "../lib/navigation";
import { searchItems, type SearchGroup, type SearchItem } from "../lib/search";
import { Kbd } from "../ui/kbd";
import {
  Columns2,
  Keyboard,
  MessageSquare,
  Monitor,
  Moon,
  Search,
  ShieldCheck,
  Workflow,
} from "../ui/icons";
import { cn } from "../ui/utils";
import { ShellModal } from "./chrome";

const groupOrder: SearchGroup[] = ["screens", "states", "flows", "comments", "actions"];
const icons: Record<SearchGroup, typeof Monitor> = {
  screens: Monitor,
  states: Monitor,
  flows: Workflow,
  comments: MessageSquare,
  actions: Keyboard,
};
const actionIcons: Record<string, typeof Monitor> = {
  theme: Moon,
  compare: Columns2,
  health: ShieldCheck,
  shortcuts: Keyboard,
};

/** The shell actions reachable from search. */
export function actionItems(t: Translate, options: { compare: boolean }): SearchItem[] {
  const actions: SearchItem[] = [
    {
      id: "a:theme",
      group: "actions",
      label: t("search.toggleTheme"),
      hint: "T",
      target: { action: "theme" },
    },
    { id: "a:health", group: "actions", label: t("search.health"), target: { action: "health" } },
    {
      id: "a:shortcuts",
      group: "actions",
      label: t("search.shortcuts"),
      hint: "?",
      target: { action: "shortcuts" },
    },
  ];
  if (options.compare) {
    actions.splice(1, 0, {
      id: "a:compare",
      group: "actions",
      label: t("search.compare"),
      hint: "3",
      target: { action: "compare" },
    });
  }
  return actions.map(item => ({ ...item, title: item.label }));
}

export function SearchPalette({
  items,
  onAction,
  onClose,
}: {
  items: SearchItem[];
  onAction: (action: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const id = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const results = searchItems(items, query).slice(0, 60);
  // Ranked results keep their order inside each group; groups appear in rank order of their
  // best item, so the best match is always first.
  const groups: { group: SearchGroup; items: SearchItem[] }[] = [];
  for (const item of results) {
    const found = groups.find(entry => entry.group === item.group);
    if (found) found.items.push(item);
    else groups.push({ group: item.group, items: [item] });
  }
  if (!query.trim())
    groups.sort((a, b) => groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group));
  const flat = groups.flatMap(entry => entry.items);
  const current = flat[Math.min(active, flat.length - 1)];
  const choose = (item: SearchItem | undefined) => {
    if (!item) return;
    onClose();
    if ("view" in item.target) go(item.target.view);
    else onAction(item.target.action);
  };
  const optionId = (item: SearchItem) => `${id}-${item.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  return (
    <ShellModal label={t("search.label")} onClose={onClose} width={560} align="top">
      <div className="flex items-center gap-2 border-b border-border px-4">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          role="combobox"
          aria-expanded="true"
          aria-controls={`${id}-list`}
          aria-activedescendant={current ? optionId(current) : undefined}
          aria-autocomplete="list"
          aria-label={t("search.label")}
          placeholder={t("search.placeholder")}
          value={query}
          onChange={event => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={event => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive(value => Math.min(value + 1, flat.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive(value => Math.max(value - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              choose(current);
            }
          }}
          className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <Kbd>Esc</Kbd>
      </div>
      <div
        id={`${id}-list`}
        role="listbox"
        aria-label={t("search.results")}
        className="max-h-[420px] overflow-y-auto p-1.5"
      >
        {flat.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground" role="status">
            {t("search.empty", { query: query.trim() })}
          </p>
        ) : (
          groups.map(entry => (
            <div
              key={entry.group}
              role="group"
              aria-label={t(`search.group.${entry.group}`)}
              className="py-1"
            >
              <div className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">
                {t(`search.group.${entry.group}`)}
              </div>
              {entry.items.map(item => {
                const index = flat.indexOf(item);
                const Icon =
                  "action" in item.target
                    ? (actionIcons[item.target.action] ?? Keyboard)
                    : icons[item.group];
                return (
                  <div
                    key={item.id}
                    id={optionId(item)}
                    role="option"
                    aria-selected={item === current}
                    onMouseMove={() => setActive(index)}
                    onClick={() => choose(item)}
                    className={cn(
                      "flex cursor-default items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px]",
                      item === current && "bg-accent text-foreground"
                    )}
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">
                      {item.label}
                      {item.detail && (
                        <span className="ml-1.5 text-muted-foreground">· {item.detail}</span>
                      )}
                    </span>
                    {item.hint && (
                      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                        {item.hint}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </ShellModal>
  );
}
