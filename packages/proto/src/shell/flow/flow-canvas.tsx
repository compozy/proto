/**
 * S4 flow canvas, after the draft's `flow-canvas.tsx`: step cards with kind eyebrows and live
 * previews (only at ≥ 60% zoom, through the canvas's own preview queue), edges styled by kind
 * with the trigger as label, the selected step's path lit, zoom/fit/minimap/stats and the
 * problem banner with offending steps outlined (US-012, US-008).
 */
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { useState, type ReactNode } from "react";

import type { EdgeKind } from "../../flow";
import type { RegistryFlow, RegistryProblem, ResolvedNode } from "../../model/registry";
import { Preview } from "../frames/preview";
import { useT } from "../lib/i18n";
import { PreviewScheduler, PreviewSchedulerProvider } from "../lib/preview-scheduler";
import { previewZoom } from "../lib/preview-queue";
import { nodeSubtitle, nodeTitle, stepKind, type StepKind } from "../lib/registry-model";
import { useShortcuts } from "../lib/shortcuts";
import { Button } from "../ui/button";
import {
  Flag,
  Globe,
  Hand,
  Layers,
  LogIn,
  Maximize2,
  Minus,
  Monitor,
  MousePointer2,
  Plus,
  TriangleAlert,
  Workflow,
} from "../ui/icons";
import { cn } from "../ui/utils";
import { cardWidth, layoutFlow } from "./layout";

export const tone: Record<StepKind, string> = {
  start: "var(--tone-start)",
  screen: "var(--tone-screen)",
  overlay: "var(--tone-overlay)",
  redirect: "var(--tone-redirect)",
  external: "var(--tone-external)",
  end: "var(--tone-end)",
};

export const glyph: Record<StepKind, typeof Monitor> = {
  start: LogIn,
  screen: Monitor,
  overlay: Layers,
  redirect: Workflow,
  external: Globe,
  end: Flag,
};

export const dash: Record<EdgeKind, string | undefined> = {
  navigate: undefined,
  overlay: "5 4",
  redirect: "1.5 4",
  external: "7 3",
};

type StepData = {
  node: ResolvedNode;
  kind: StepKind;
  selected: boolean;
  lit: boolean;
  problem: boolean;
  uncovered: string[];
  theme: "light" | "dark";
  previews: boolean;
  badge: ReactNode;
};
type StepNode = Node<StepData, "step">;
type LinkEdge = Edge<{ on: string; kind: EdgeKind; lit: boolean }, "link">;

function StepCard({ data }: NodeProps<StepNode>) {
  const t = useT();
  const { node, kind, selected, lit, problem, uncovered, theme, previews, badge } = data;
  const Icon = glyph[kind];
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-[var(--shell-panel)] p-2.5 transition-shadow",
        selected &&
          "border-primary shadow-[0_0_0_4px_var(--shell-primary-soft),0_0_32px_-4px_var(--shell-primary-glow)]",
        node.kind === "external" && "border-dashed",
        problem &&
          "border-destructive shadow-[0_0_0_3px_color-mix(in_oklch,var(--destructive)_20%,transparent)]"
      )}
      style={{ width: cardWidth }}
    >
      <Handle type="target" position={Position.Left} className={cn(lit && "is-lit")} />
      <Handle id="top-in" type="target" position={Position.Top} className="!opacity-0" />
      <Handle id="bottom-in" type="target" position={Position.Bottom} className="!opacity-0" />
      <div className="flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded-md border border-border bg-background text-muted-foreground">
          <Icon className="size-3.5" />
        </span>
        <span
          className="font-mono text-[10px] font-medium tracking-[0.08em] uppercase"
          style={{ color: tone[kind] }}
        >
          {t(`kind.${kind}`)}
        </span>
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
          {badge}
          {node.step > 0 && <span>#{node.step}</span>}
        </span>
      </div>
      <div className="mt-2 px-0.5">
        <div className="truncate text-[13px] font-semibold tracking-tight">{nodeTitle(node)}</div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
          {nodeSubtitle(node)}
        </div>
      </div>
      {node.kind === "prototype" && (
        <div className="mt-2.5 overflow-hidden rounded-lg border border-border">
          {previews ? (
            <Preview
              target={{ slug: node.proto, state: node.state, theme, role: node.role ?? null }}
              title={t("preview.of", { title: `${node.title} · ${node.stateLabel}` })}
              width={720}
              height={420}
              order={node.step || 999}
            />
          ) : (
            <div className="grid aspect-[720/420] place-items-center bg-background font-mono text-[10px] text-muted-foreground">
              {node.proto}
            </div>
          )}
        </div>
      )}
      {uncovered.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5 rounded-md bg-[color-mix(in_oklch,var(--tone-warning)_12%,transparent)] px-2 py-1 text-[11px] text-[var(--tone-warning)]">
          <TriangleAlert className="size-3 shrink-0" />
          <span className="truncate">
            {t("flow.uncoveredState", { state: uncovered.join(", ") })}
          </span>
        </div>
      )}
      <Handle type="source" position={Position.Right} className={cn(lit && "is-lit")} />
      <Handle id="bottom-out" type="source" position={Position.Bottom} className="!opacity-0" />
      <Handle id="top-out" type="source" position={Position.Top} className="!opacity-0" />
    </div>
  );
}

function LinkLine({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<LinkEdge>) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const lit = data?.lit ?? false;
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        className={cn(lit && "is-lit")}
        style={{ strokeDasharray: dash[data?.kind ?? "navigate"] }}
      />
      <EdgeLabelRenderer>
        <span
          className={cn(
            "nodrag nopan absolute rounded-md border bg-[var(--shell-panel)] px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap",
            lit ? "border-primary/50 text-primary" : "border-border text-muted-foreground"
          )}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        >
          {data?.on}
        </span>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { step: StepCard };
const edgeTypes = { link: LinkLine };

export type FlowCanvasProps = {
  flow: RegistryFlow;
  selected: string | null;
  onSelect: (node: string | null) => void;
  problems: RegistryProblem[];
  /** Uncovered state labels per prototype slug. */
  uncovered: Map<string, string[]>;
  theme: "light" | "dark";
  /** Per-step badge (open comment count, review slice). */
  badge?: (node: ResolvedNode) => ReactNode;
  tools?: ReactNode;
};

function FlowSurface({
  flow,
  selected,
  onSelect,
  problems,
  uncovered,
  theme,
  badge,
  tools,
}: FlowCanvasProps) {
  const t = useT();
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const zoom = useStore(state => state.transform[2]);
  const [pan, setPan] = useState(false);
  // Controlled nodes: measured sizes come back as `dimensions` changes (fit view, minimap).
  const [sizes, setSizes] = useState<Record<string, { width: number; height: number }>>({});
  const layout = layoutFlow(flow);
  const offending = new Set(problems.flatMap(problem => (problem.node ? [problem.node] : [])));
  const touches = (edge: { from: string; to: string }) =>
    edge.from === selected || edge.to === selected;
  const nodes: StepNode[] = flow.nodes.map(node => {
    const box = layout.byId.get(node.id);
    return {
      id: node.id,
      type: "step",
      position: { x: box?.x ?? 0, y: box?.y ?? 0 },
      selectable: !pan,
      selected: node.id === selected,
      measured: sizes[node.id],
      initialWidth: cardWidth,
      initialHeight: box?.height,
      ariaLabel: `${t(`kind.${stepKind(flow, node)}`)}: ${nodeTitle(node)}`,
      data: {
        node,
        kind: stepKind(flow, node),
        selected: node.id === selected,
        measured: sizes[node.id],
        initialWidth: cardWidth,
        initialHeight: box?.height,
        lit: flow.edges.some(
          edge => touches(edge) && (edge.from === node.id || edge.to === node.id)
        ),
        problem: offending.has(node.id),
        uncovered: node.kind === "prototype" ? (uncovered.get(node.proto) ?? []) : [],
        theme,
        previews: zoom >= previewZoom,
        badge: badge?.(node),
      },
    };
  });
  const edges: LinkEdge[] = flow.edges.map(edge => {
    const route = layout.route(edge.from, edge.to);
    const below = (layout.byId.get(edge.to)?.y ?? 0) > (layout.byId.get(edge.from)?.y ?? 0);
    return {
      id: `${edge.from}->${edge.to}`,
      type: "link",
      source: edge.from,
      target: edge.to,
      ...(route === "back" && { sourceHandle: "bottom-out", targetHandle: "bottom-in" }),
      ...(route === "same" &&
        (below
          ? { sourceHandle: "bottom-out", targetHandle: "top-in" }
          : { sourceHandle: "top-out", targetHandle: "bottom-in" })),
      data: { on: edge.on, kind: edge.kind, lit: touches(edge) },
    };
  });
  const fit = () => void fitView({ padding: 0.14, duration: 200 });
  useShortcuts({ f: fit });
  const dark = theme === "dark";
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={changes => {
        const measured = changes.flatMap(change =>
          change.type === "dimensions" && change.dimensions
            ? [[change.id, change.dimensions] as const]
            : []
        );
        if (measured.length) setSizes(current => ({ ...current, ...Object.fromEntries(measured) }));
        // Clicks and Enter on a focused step both arrive as selection changes.
        const picked = changes.find(change => change.type === "select" && change.selected);
        if (picked && "id" in picked && !pan) onSelect(picked.id);
      }}
      onPaneClick={() => {
        if (!pan) onSelect(null);
      }}
      fitView
      fitViewOptions={{ padding: 0.14 }}
      minZoom={0.2}
      maxZoom={1.5}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={!pan}
      panOnScroll
      proOptions={{ hideAttribution: true }}
      className={cn(pan && "cursor-grab")}
      aria-label={t("flow.canvas")}
    >
      <Panel position="top-left" className="!m-4">
        <div
          role="toolbar"
          aria-label={t("flow.tools")}
          className="flex items-center gap-0.5 rounded-xl border border-border bg-[var(--shell-panel)] p-1"
        >
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("flow.select")}
            aria-pressed={!pan}
            className={cn(!pan && "bg-[var(--shell-primary-soft)] text-primary")}
            onClick={() => setPan(false)}
          >
            <MousePointer2 />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("flow.pan")}
            aria-pressed={pan}
            className={cn(pan && "bg-[var(--shell-primary-soft)] text-primary")}
            onClick={() => setPan(true)}
          >
            <Hand />
          </Button>
          {tools}
        </div>
      </Panel>
      <Panel
        position="top-right"
        className="!m-4 hidden items-center gap-4 font-mono text-[10.5px] whitespace-nowrap text-muted-foreground 2xl:flex"
      >
        <Legend pattern={dash.navigate} label={t("flow.legend.navigate")} />
        <Legend pattern={dash.overlay} label={t("flow.legend.overlay")} />
        <Legend pattern={dash.redirect} label={t("flow.legend.redirect")} />
        <Legend pattern={dash.external} label={t("flow.legend.external")} />
      </Panel>
      <Panel position="bottom-left" className="!m-4">
        <div className="flex h-9 items-center gap-1 rounded-xl border border-border bg-[var(--shell-panel)] px-1.5 text-[13px]">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("flow.zoomOut")}
            onClick={() => void zoomOut()}
          >
            <Minus />
          </Button>
          <span className="w-10 text-center font-medium tabular-nums" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("flow.zoomIn")}
            onClick={() => void zoomIn()}
          >
            <Plus />
          </Button>
          <span className="mx-1 h-4 w-px bg-border" />
          <Button
            variant="ghost"
            size="xs"
            aria-label={t("flow.fit")}
            aria-keyshortcuts="F"
            className="text-muted-foreground"
            onClick={fit}
          >
            <Maximize2 data-icon="inline-start" />
            <span className="hidden xl:inline">{t("flow.fitLabel")}</span>
          </Button>
        </div>
      </Panel>
      <Panel position="bottom-center" className="!mb-4 hidden xl:block">
        <FlowStats flow={flow} uncovered={[...uncovered.values()].flat().length} />
      </Panel>
      <MiniMap
        position="bottom-right"
        pannable
        zoomable
        ariaLabel={t("flow.minimap")}
        nodeBorderRadius={6}
        nodeColor={node =>
          node.id === selected ? (dark ? "#ff6bb5" : "#e5277e") : dark ? "#3b3a42" : "#d9d4da"
        }
        maskColor={dark ? "rgba(10, 9, 12, 0.55)" : "rgba(250, 247, 249, 0.6)"}
        style={{ width: 176, height: 112 }}
        className="!m-4 max-lg:!hidden"
      />
    </ReactFlow>
  );
}

function FlowStats({ flow, uncovered }: { flow: RegistryFlow; uncovered: number }) {
  const t = useT();
  return (
    <div className="flex h-9 items-center gap-3 rounded-xl border border-border bg-[var(--shell-panel)] px-3.5 text-xs whitespace-nowrap text-muted-foreground">
      <span>
        <b className="font-semibold text-foreground">{flow.nodes.length}</b>{" "}
        {t("flow.steps", { count: flow.nodes.length })}
      </span>
      <span className="h-3.5 w-px bg-border" />
      <span>
        <b className="font-semibold text-foreground">{flow.edges.length}</b>{" "}
        {t("flow.transitions", { count: flow.edges.length })}
      </span>
      {uncovered > 0 && (
        <>
          <span className="h-3.5 w-px bg-border" />
          <span className="text-[var(--tone-warning)]">
            {t("count.uncoveredStates", { count: uncovered })}
          </span>
        </>
      )}
    </div>
  );
}

function Legend({ pattern, label }: { pattern?: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="22" height="6" aria-hidden="true">
        <line
          x1="0"
          y1="3"
          x2="22"
          y2="3"
          stroke="var(--shell-edge)"
          strokeWidth="1.5"
          strokeDasharray={pattern}
        />
      </svg>
      {label}
    </span>
  );
}

/** The flow canvas: dotted surface, its own preview queue and the problem banner. */
export function FlowCanvas(props: FlowCanvasProps) {
  const t = useT();
  const [scheduler] = useState(() => new PreviewScheduler());
  return (
    <div className="shell-dots relative min-h-0 min-w-0 flex-1">
      {props.problems.length > 0 && (
        <div
          role="alert"
          className="absolute inset-x-4 top-16 z-10 mx-auto max-w-[640px] rounded-xl border border-destructive/40 bg-[var(--shell-panel)] p-3 text-[13px] shadow-lg"
        >
          <div className="flex items-center gap-2 font-medium text-destructive">
            <TriangleAlert className="size-4" />
            {t("flow.problems", { count: props.problems.length })}
          </div>
          <ul className="mt-1.5 flex flex-col gap-1">
            {props.problems.map((problem, index) => (
              <li key={`${problem.code}-${index}`} className="flex gap-2 text-xs">
                <span className="shrink-0 font-mono text-destructive uppercase">
                  {problem.code}
                </span>
                <span className="min-w-0 truncate text-foreground/85">{problem.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <PreviewSchedulerProvider value={scheduler}>
        <ReactFlowProvider>
          <FlowSurface {...props} />
        </ReactFlowProvider>
      </PreviewSchedulerProvider>
    </div>
  );
}
