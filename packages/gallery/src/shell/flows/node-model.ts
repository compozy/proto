/**
 * How flow nodes are named and opened, shared by the node cards, the canvas and the inspector.
 */
import { externalLabels, type ResolvedNode } from "../../flow";
import { select, type Selection } from "../view";

type PrototypeStep = Extract<ResolvedNode, { kind: "prototype" }>;
type ExternalStep = Extract<ResolvedNode, { kind: "external" }>;

/** `https://example.com/#pricing` → `example.com/#pricing`. */
export function displayUrl(url: string) {
  return url.replace(/^https:\/\//, "");
}

export function externalName(node: ExternalStep) {
  return node.label || externalLabels[node.external];
}

export function nodeName(node: ResolvedNode) {
  return node.kind === "prototype" ? node.title : externalName(node);
}

/** What a step is called in comments and links: `3. Sign in · Error`. */
export function stepLabel(node: ResolvedNode) {
  return `${node.step}. ${nodeName(node)}${node.kind === "prototype" ? ` · ${node.stateLabel}` : ""}`;
}

/** The gallery selection that opens a prototype node at its state and role. */
export function prototypeSelection(node: PrototypeStep): Selection {
  return { kind: "prototype", slug: node.proto, state: node.state, role: node.role ?? null };
}

/** Opens the node: a prototype at its state and role in the gallery, an external URL in a tab. */
export function openNode(node: ResolvedNode) {
  if (node.kind === "prototype") select(prototypeSelection(node));
  else if (node.url) window.open(node.url, "_blank", "noopener,noreferrer");
}
