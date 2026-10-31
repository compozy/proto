/**
 * The levels of what is on screen, widest first (specs index → spec → page → state, or
 * index → spec → flow → step), for the breadcrumb and the "copy link" menu.
 */
import type { FlowEntry } from "../flow";
import { nodeName } from "./flows/node-model";
import { specSlug, type Entry, type Group } from "./registry-model";
import type { Crumb } from "./topbar";

export const indexCrumb: Crumb = { label: "Specs", target: { kind: "index" } };

export function specCrumb(group: Group): Crumb {
  return {
    label: group.title,
    detail: specSlug(group),
    target: { kind: "spec", spec: group.id },
  };
}

export function prototypeCrumbs(group: Group | undefined, entry: Entry, state: string): Crumb[] {
  const { meta } = entry;
  const index = meta.states.findIndex(option => option.id === state);
  const option = meta.states[index];
  return [
    indexCrumb,
    ...(group ? [specCrumb(group)] : []),
    {
      label: meta.title,
      detail: `screen · ${meta.surface} · /${entry.slug}`,
      target: { kind: "prototype", slug: entry.slug },
    },
    ...(option
      ? [
          {
            label: option.label,
            detail: `state ${index + 1} of ${meta.states.length} · ${option.id}`,
            target: { kind: "prototype", slug: entry.slug, state: option.id },
          } satisfies Crumb,
        ]
      : []),
  ];
}

export function flowCrumbs(
  owner: Group | undefined,
  flow: FlowEntry,
  node: string | null
): Crumb[] {
  const step = flow.nodes.find(item => item.id === node);
  return [
    indexCrumb,
    ...(owner ? [specCrumb(owner)] : []),
    {
      label: flow.title,
      detail: `flow · ${flow.id}`,
      target: { kind: "flow", flow: flow.id },
    },
    ...(step
      ? [
          {
            label: nodeName(step),
            detail: `step ${step.step} of ${flow.nodes.length} · ${step.id}`,
            target: { kind: "flow", flow: flow.id, node: step.id },
          } satisfies Crumb,
        ]
      : []),
  ];
}

/** Every level that has its own view, deepest first: what "copy link" offers. */
export function copyTargets(crumbs: Crumb[]) {
  return crumbs.filter(crumb => crumb.target.kind !== "index").reverse();
}
