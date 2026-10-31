import { specPosition, specSlug, type Entry, type Group, type Registry } from "./registry-model";
export type NavLevel = "specs" | "prototypes" | "states";

export const levels: readonly NavLevel[] = ["specs", "prototypes", "states"];

export const offsets: Record<NavLevel, string> = {
  specs: "translate-x-0",
  prototypes: "-translate-x-1/3",
  states: "-translate-x-2/3",
};

/**
 * Two-line sidebar row on `SidebarMenuButton`: selection and hover are fills (`data-active`,
 * `aria-current`), never rings, and focus is an inset ring.
 */
export const rowClass =
  "h-auto min-h-10 items-start gap-2.5 rounded-lg px-3 py-2 data-active:font-normal hover:bg-card/70 dark:hover:bg-sidebar-accent/60 aria-[current]:bg-card dark:aria-[current]:bg-sidebar-accent focus-visible:ring-inset";

/** Position in an ordered list, as the sidebar prints it (`01`, `02`…). */
export function ordinal(index: number) {
  return String(index + 1).padStart(2, "0");
}

/** A spec's number and slug, `03 · mentorships`. */
export function specCode(registry: Registry, group: Group) {
  const position = specPosition(registry, group.id);
  return position === null ? specSlug(group) : `${ordinal(position)} · ${specSlug(group)}`;
}

export function plural(count: number, word: string) {
  return `${count} ${count === 1 ? word : `${word}s`}`;
}

export function matches(entry: Entry, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const { meta } = entry;
  return [meta.title, entry.slug, meta.route, meta.surface, meta.spec ?? ""].some(value =>
    (value ?? "").toLowerCase().includes(needle)
  );
}
