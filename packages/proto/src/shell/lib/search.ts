/**
 * ⌘K search (US-015, UT-025): prototypes, states, flows and their steps, comments and actions,
 * ranked exact slug > title > state label > comment text. Pure: no DOM.
 */
import type { Registry } from "../../model/registry";
import { nodeTitle } from "./registry-model";
import { screenView, type View } from "./view";

export type SearchGroup = "screens" | "states" | "flows" | "comments" | "actions";

export type SearchItem = {
  id: string;
  group: SearchGroup;
  label: string;
  /** Secondary text shown after the label. */
  detail?: string;
  /** Right-aligned hint: a route or a shortcut. */
  hint?: string;
  /** What the item matches on, by rank tier. */
  slug?: string;
  title?: string;
  stateLabel?: string;
  text?: string;
  target: { view: View } | { action: string };
};

/** Rank tiers: lower wins. */
const tiers = ["slug", "title", "stateLabel", "text"] as const;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** The tier an item matches the query at, and whether that match is a prefix; null = no match. */
function match(item: SearchItem, query: string) {
  if (item.slug && normalize(item.slug) === query) return { tier: 0, prefix: true };
  for (const [index, field] of tiers.entries()) {
    const value = item[field];
    if (!value) continue;
    const at = normalize(value).indexOf(query);
    if (at >= 0) return { tier: index === 0 ? 1 : index, prefix: at === 0 };
  }
  return null;
}

/** Items matching `query`, best first; stable within a tier (prefix matches first). */
export function searchItems(items: readonly SearchItem[], query: string) {
  const needle = normalize(query);
  if (!needle) return [...items];
  return items
    .flatMap((item, order) => {
      const found = match(item, needle);
      return found ? [{ item, order, ...found }] : [];
    })
    .sort((a, b) => a.tier - b.tier || Number(b.prefix) - Number(a.prefix) || a.order - b.order)
    .map(entry => entry.item);
}

/** Search items of a registry: every prototype, each of its states, flows and their steps. */
export function registryItems(registry: Registry): SearchItem[] {
  const items: SearchItem[] = [];
  for (const prototype of registry.prototypes) {
    items.push({
      id: `p:${prototype.slug}`,
      group: "screens",
      label: prototype.title,
      detail: prototype.slug,
      hint: prototype.route ?? undefined,
      slug: prototype.slug,
      title: prototype.title,
      target: { view: screenView(prototype.slug) },
    });
    for (const state of prototype.states) {
      items.push({
        id: `s:${prototype.slug}:${state.id}`,
        group: "states",
        label: `${prototype.title} · ${state.label}`,
        hint: prototype.route ?? undefined,
        stateLabel: state.label,
        text: state.id,
        target: { view: screenView(prototype.slug, state.id) },
      });
    }
  }
  for (const flow of registry.flows) {
    items.push({
      id: `f:${flow.id}`,
      group: "flows",
      label: flow.title,
      detail: flow.id,
      slug: flow.id,
      title: flow.title,
      target: { view: { area: "flow", flow: flow.id, node: null } },
    });
    for (const node of flow.nodes) {
      items.push({
        id: `f:${flow.id}:${node.id}`,
        group: "flows",
        label: `${flow.title} · ${nodeTitle(node)}`,
        detail: node.step ? `#${node.step}` : undefined,
        stateLabel: nodeTitle(node),
        target: { view: { area: "flow", flow: flow.id, node: node.id } },
      });
    }
  }
  return items;
}
