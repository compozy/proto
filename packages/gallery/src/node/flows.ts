import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import type { ResolvedGalleryConfig } from "../config.ts";
import { bfsOrder, coverage, deadEnds, duplicateEdges, unreachable } from "../flow-graph.ts";
import { edgeKinds, externalLabels } from "../flow.ts";
import type {
  CoverageWarning,
  EdgeKind,
  ExternalService,
  FlowEntry,
  FlowProblem,
  FlowProblemCode,
  ResolvedEdge,
  ResolvedNode,
} from "../flow.ts";
import type { PrototypeEntry } from "./discovery.ts";
import { LiteralError, readLiteral } from "./literal.ts";

export type {
  CoverageWarning,
  FlowEntry,
  FlowProblem,
  FlowProblemCode,
  ResolvedEdge,
  ResolvedNode,
} from "../flow.ts";

const ignored = new Set([
  "node_modules",
  "dist",
  "dist-gallery",
  "storybook-static",
  "coverage",
  "test-results",
  "playwright-report",
]);
const edgeFields = new Set(["on", "kind"]);
const knownEdgeKinds = new Set<EdgeKind>(edgeKinds);
export const validFlowId = (id: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id) && id.length <= 120;
const text = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
type Report = (code: FlowProblemCode, message: string, node?: string) => void;

function files(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith(".") || ignored.has(entry.name)) return [];
    const path = join(root, entry.name);
    return entry.isDirectory()
      ? files(path)
      : entry.isFile() && entry.name.endsWith(".flow.ts")
        ? [path]
        : [];
  });
}

function declaration(file: string): unknown {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true
  );
  for (const statement of source.statements) {
    if (
      !ts.isVariableStatement(statement) ||
      !statement.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
    )
      continue;
    for (const declaration of statement.declarationList.declarations) {
      const value = declaration.initializer;
      if (
        !ts.isIdentifier(declaration.name) ||
        declaration.name.text !== "flow" ||
        !value ||
        !ts.isCallExpression(value) ||
        !ts.isIdentifier(value.expression) ||
        value.expression.text !== "defineFlow" ||
        value.arguments.length !== 1
      )
        continue;
      return readLiteral(value.arguments[0]!);
    }
  }
  throw new LiteralError("not_literal");
}

function externalUrl(value: string, siteUrl: string | null): string | null {
  // Protocol-relative and backslash paths must not change the configured site origin.
  if (/\s|\\/.test(value)) return null;
  if (!(value.startsWith("/") && siteUrl) && !value.startsWith("https://")) return null;
  if (value.startsWith("//")) return null;
  try {
    const url = new URL(value, siteUrl ?? undefined);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function resolveNode(
  id: string,
  value: unknown,
  start: string[],
  prototypes: readonly PrototypeEntry[],
  config: ResolvedGalleryConfig,
  report: Report
): ResolvedNode | null {
  if (!object(value) || !validFlowId(id) || "proto" in value === "external" in value) {
    report("invalid_node", `node "${id}" must set either proto and state, or external`, id);
    return null;
  }
  if (value.end !== undefined && typeof value.end !== "boolean") {
    report("invalid_flow", `node "${id}": end must be a boolean`, id);
    return null;
  }
  const position = { id, end: value.end === true, start: start.includes(id), step: 0 };
  if ("proto" in value) {
    if (
      !text(value.proto) ||
      !text(value.state) ||
      Object.keys(value).some(key => !["proto", "state", "role", "end"].includes(key))
    ) {
      report("invalid_flow", `node "${id}": expected proto, state and optional role/end`, id);
      return null;
    }
    const prototype = prototypes.find(entry => entry.slug === value.proto);
    if (!prototype?.meta) {
      report(
        "unknown_prototype",
        `node "${id}" uses prototype "${value.proto}" that does not exist`,
        id
      );
      return null;
    }
    const { meta } = prototype;
    const state = meta.states.find(state => state.id === value.state);
    if (!state) {
      report(
        "unknown_state",
        `node "${id}" uses state "${value.state}" that ${value.proto} does not declare (${meta.states.map(state => state.id).join(", ")})`,
        id
      );
      return null;
    }
    const roles: readonly string[] = meta.roles ?? Object.keys(config.roles);
    if (
      value.role !== undefined &&
      (typeof value.role !== "string" || !roles.includes(value.role))
    ) {
      report(
        "unknown_role",
        `node "${id}" uses role "${value.role}" that ${value.proto} does not support (${roles.join(", ")})`,
        id
      );
      return null;
    }
    return {
      ...position,
      kind: "prototype",
      proto: value.proto,
      state: state.id,
      stateLabel: state.label,
      title: meta.title,
      route: meta.route,
      spec: meta.spec ?? null,
      ...(value.role === undefined ? {} : { role: value.role }),
    };
  }
  if (
    !text(value.external) ||
    !Object.hasOwn(externalLabels, value.external) ||
    Object.keys(value).some(key => !["external", "label", "url", "end"].includes(key)) ||
    (value.label !== undefined && !text(value.label)) ||
    (value.external === "other" && !text(value.label))
  ) {
    report(
      "invalid_flow",
      `node "${id}": expected a known external service and a label for other`,
      id
    );
    return null;
  }
  const url = typeof value.url === "string" ? externalUrl(value.url, config.siteUrl) : null;
  if (value.url !== undefined && !url) {
    report(
      "invalid_flow",
      `node "${id}": url must be an absolute HTTPS URL, or a path when gallery.config.ts sets siteUrl`,
      id
    );
    return null;
  }
  const external = value.external as ExternalService;
  return {
    ...position,
    kind: "external",
    external,
    label: typeof value.label === "string" ? value.label : externalLabels[external],
    url,
  };
}

function resolveFlow(
  id: string,
  file: string,
  value: unknown,
  prototypes: readonly PrototypeEntry[],
  config: ResolvedGalleryConfig,
  report: Report
): FlowEntry | null {
  if (
    !object(value) ||
    !text(value.title) ||
    (value.spec !== undefined && !text(value.spec)) ||
    (value.description !== undefined && !text(value.description)) ||
    !Array.isArray(value.start) ||
    !value.start.length ||
    !value.start.every(text) ||
    !object(value.nodes) ||
    !Object.keys(value.nodes).length ||
    !Array.isArray(value.edges) ||
    Object.keys(value).some(
      key => !["title", "spec", "description", "start", "nodes", "edges"].includes(key)
    )
  ) {
    report("invalid_flow", `${id}: expected title, optional spec, non-empty start/nodes and edges`);
    return null;
  }
  const spec = typeof value.spec === "string" ? value.spec : null;
  if (spec !== null && !Object.hasOwn(config.specs, spec))
    report("unknown_spec", `${id}: unknown spec "${spec}" (not in gallery.config.ts)`);
  if (new Set(value.start).size !== value.start.length)
    report("invalid_flow", `${id}: start must not repeat node ids`);
  const nodeIds = Object.keys(value.nodes);
  const declaredNodes = new Set(nodeIds);
  for (const node of value.start) {
    if (!declaredNodes.has(node))
      report("unknown_node", `start names node "${node}" that the flow does not declare`, node);
  }
  const nodes = Object.entries(value.nodes).flatMap(([node, data]) => {
    const resolved = resolveNode(node, data, value.start as string[], prototypes, config, report);
    return resolved ? [resolved] : [];
  });
  const edges: ResolvedEdge[] = [];
  for (const edge of value.edges) {
    if (
      !Array.isArray(edge) ||
      edge.length !== 3 ||
      !text(edge[0]) ||
      !text(edge[1]) ||
      !object(edge[2]) ||
      !text(edge[2].on) ||
      Object.keys(edge[2]).some(key => !edgeFields.has(key)) ||
      (edge[2].kind !== undefined && !knownEdgeKinds.has(edge[2].kind as EdgeKind))
    ) {
      report("invalid_flow", `${id}: edges must be [from, to, { on, kind? }] with a known kind`);
      continue;
    }
    const [from, to, options] = edge;
    for (const node of new Set([from, to])) {
      if (!declaredNodes.has(node))
        report(
          "unknown_node",
          `edge ${from} → ${to} names node "${node}" that the flow does not declare`,
          node
        );
    }
    edges.push({
      from,
      to,
      on: options.on as string,
      kind: (options.kind as EdgeKind | undefined) ?? "navigate",
    });
  }
  for (const edge of duplicateEdges(edges))
    report("duplicate_edge", `edge ${edge.from} → ${edge.to} "${edge.on}" is declared twice`);
  const order = bfsOrder(value.start, edges);
  for (const node of unreachable(nodeIds, order))
    report("unreachable", `node "${node}" is unreachable from start`, node);
  for (const node of deadEnds(nodes, edges))
    report("dead_end", `node "${node}" is a dead end (no outgoing edge and not end)`, node);
  const sorted = order.flatMap((id, index) => {
    const node = nodes.find(node => node.id === id);
    return node ? [{ ...node, step: index + 1 }] : [];
  });
  return {
    id,
    file,
    title: value.title,
    spec,
    description: typeof value.description === "string" ? value.description : null,
    start: value.start,
    nodes: sorted,
    edges,
    specs: [
      ...new Set([
        ...(spec === null ? [] : [spec]),
        ...sorted.flatMap(node => (node.kind === "prototype" && node.spec ? [node.spec] : [])),
      ]),
    ],
  };
}

/** Every `apps/<app>/flows/<id>.flow.ts`, parsed without executing it and resolved against prototypes. */
export function findFlows(
  appRoot: string,
  repoRoot: string,
  prototypes: readonly PrototypeEntry[],
  config: ResolvedGalleryConfig
): { flows: FlowEntry[]; problems: FlowProblem[]; warnings: CoverageWarning[] } {
  const flows: FlowEntry[] = [];
  const problems: FlowProblem[] = [];
  for (const path of files(appRoot).sort()) {
    const local = relative(appRoot, path);
    const file = relative(repoRoot, path);
    const id = path.split("/").at(-1)!.slice(0, -8);
    const before = problems.length;
    const report: Report = (code, message, node) =>
      problems.push({ code, flow: id, file, ...(node ? { node } : {}), message });
    if (!/^flows\/[^/]+\.flow\.ts$/.test(local)) {
      report("flow_outside_root", `${file}: flows live in the app's flows/<id>.flow.ts`);
      continue;
    }
    if (!validFlowId(id)) report("invalid_flow_id", `Invalid flow id "${id}" (${file})`);
    let value: unknown;
    try {
      value = declaration(path);
    } catch (error) {
      if (error instanceof LiteralError && error.reason === "duplicate_key") {
        const node = error.path.length === 1 && error.path[0] === "nodes" ? error.key : undefined;
        report(
          node ? "duplicate_node" : "invalid_flow",
          node
            ? `node "${node}" is declared twice`
            : `${id}: property "${error.key}" is declared twice`,
          node
        );
      } else report("missing_flow", `${id}: missing literal export flow`);
      continue;
    }
    const flow = resolveFlow(id, file, value, prototypes, config, report);
    if (flow && problems.length === before) flows.push(flow);
  }
  const specOrder = Object.keys(config.specs);
  const position = (spec: string | null) => {
    const index = spec === null ? -1 : specOrder.indexOf(spec);
    return index === -1 ? specOrder.length : index;
  };
  flows.sort(
    (a, b) =>
      position(a.spec) - position(b.spec) ||
      a.title.localeCompare(b.title, "en") ||
      a.id.localeCompare(b.id)
  );
  return {
    flows,
    problems,
    warnings: coverage(
      flows,
      prototypes.map(entry => ({
        slug: entry.slug,
        spec: entry.meta?.spec,
        states: entry.meta?.states.map(state => state.id) ?? [],
      }))
    ),
  };
}
