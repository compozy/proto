/**
 * What the gallery shows, derived from the URL: the specs index, a spec overview, a flow, the
 * "Flow not found" notice or a prototype (with its state), plus the sidebar level that
 * follows it (index → specs, spec or flow → the spec's level, prototype → its states). Keeps the
 * URL canonical, so a copied link always reopens what is on screen.
 */
import { useEffect, useEffectEvent } from "react";

import { setParams, useSearch } from "../contract";
import { activeSpec, groupOf, type Entry, type Registry } from "./registry-model";
import type { NavLevel } from "./sidebar-model";
import {
  canonicalParams,
  readView,
  resolveSelection,
  select,
  updateView,
  type ResolvedKind,
} from "./view";

/** The item after (or before) `current`, wrapping around; the first one when nothing is current. */
export function step<T>(items: readonly T[], current: T | undefined, direction: 1 | -1) {
  if (items.length === 0) return undefined;
  const index = current === undefined ? -1 : items.indexOf(current);
  return items[(index + direction + items.length) % items.length];
}

/** Sidebar level of each selection: the drill-down mirrors the URL. */
export function levelOf(kind: ResolvedKind): NavLevel {
  if (kind === "prototype") return "states";
  return kind === "spec" || kind === "flow" ? "prototypes" : "specs";
}

export function useGallerySelection(registry: Registry) {
  const search = useSearch();
  const view = readView(search);
  const entries = registry.entries;
  const resolved = resolveSelection(view, {
    flows: registry.flows,
    prototypeExists: slug => entries.some(entry => entry.slug === slug),
    specExists: spec => groupOf(registry, spec) !== undefined,
  });
  const flow = resolved.kind === "flow" ? resolved.flow : null;
  const missingFlow = resolved.kind === "missing-flow" ? resolved.id : null;
  const current: Entry | null =
    resolved.kind === "prototype"
      ? (entries.find(entry => entry.slug === resolved.slug) ?? null)
      : null;
  const spec = resolved.kind === "spec" ? resolved.spec : null;
  const active = flow
    ? activeSpec(registry, { kind: "flow", flow })
    : (spec ?? activeSpec(registry, { kind: "prototype", entry: current }));
  const states = current?.meta.states ?? [];
  const state = states.find(option => option.id === view.state)?.id ?? states[0]?.id ?? "";

  // Make the URL name what is on screen, so a copied link always reopens it.
  const syncUrl = useEffectEvent(() => {
    const patch = canonicalParams(search, resolved);
    if (patch) setParams(patch);
  });
  useEffect(() => syncUrl(), [search]);

  /** Next or previous journey ("Journeys" order). */
  const stepFlow = (direction: 1 | -1) => {
    const next = step(registry.flows, flow ?? undefined, direction);
    if (next) select({ kind: "flow", flow: next.id });
  };

  /** Next or previous step of the open flow, in journey order. */
  const stepNode = (direction: 1 | -1) => {
    if (!flow) return;
    const ids = flow.nodes.map(node => node.id);
    const next = step(ids, view.node && ids.includes(view.node) ? view.node : undefined, direction);
    if (next) updateView({ node: next });
  };

  return {
    stepFlow,
    stepNode,
    view,
    resolved,
    flow,
    missingFlow,
    current,
    spec,
    active,
    states,
    state,
    level: levelOf(resolved.kind),
  };
}
