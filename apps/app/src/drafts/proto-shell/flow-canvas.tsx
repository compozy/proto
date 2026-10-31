import { Button } from "@proto/ui/components/button";
import {
  Globe,
  Hand,
  LogIn,
  Maximize2,
  MessageSquare,
  MessageSquarePlus,
  Minus,
  Monitor,
  MousePointer2,
  Flag,
  Layers,
  Plus,
  TriangleAlert,
  Workflow,
} from "@proto/ui/lib/icons";
import { cn } from "@proto/ui/lib/utils";
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
  useNodesState,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";

import { flow, kindLabel, previewUrl, type EdgeKind, type FlowStep, type NodeKind } from "./data";
import { LivePreview, useShellTheme } from "./preview";

type StepNode = Node<{ step: FlowStep; selected: boolean; lit: boolean }, "step">;
type LinkEdge = Edge<{ on: string; kind: EdgeKind; lit: boolean }, "link">;

const tone: Record<NodeKind, string> = {
  start: "var(--tone-start)",
  screen: "var(--tone-screen)",
  overlay: "var(--tone-overlay)",
  redirect: "var(--tone-redirect)",
  external: "var(--tone-external)",
  end: "var(--tone-end)",
};

const glyph: Record<NodeKind, typeof Monitor> = {
  start: Globe,
  screen: Monitor,
  overlay: Layers,
  redirect: Workflow,
  external: Globe,
  end: Flag,
};

const dash: Record<EdgeKind, string | undefined> = {
  navigate: undefined,
  overlay: "5 4",
  redirect: "1.5 4",
  external: "7 3",
};

/** One flow step: kind label, title, route and state, and a live preview of the screen. */
function StepCard({ data }: NodeProps<StepNode>) {
  const { step, selected, lit } = data;
  const Icon = step.kind === "start" ? LogIn : glyph[step.kind];
  return (
    <div
      className={cn(
        "w-[248px] rounded-xl border border-border bg-[var(--shell-panel)] p-2.5 transition-shadow",
        selected &&
          "border-primary shadow-[0_0_0_4px_var(--shell-primary-soft),0_0_32px_-4px_var(--shell-primary-glow)]",
        !step.proto && "border-dashed"
      )}
    >
      <Handle type="target" position={Position.Left} className={cn(lit && "is-lit")} />
      <Handle id="top" type="target" position={Position.Top} className="!opacity-0" />
      <Handle id="bottom-in" type="target" position={Position.Bottom} className="!opacity-0" />
      <div className="flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded-md border border-border bg-background text-muted-foreground">
          <Icon className="size-3.5" />
        </span>
        <span
          className="font-mono text-[10px] font-medium tracking-[0.08em] uppercase"
          style={{ color: tone[step.kind] }}
        >
          {kindLabel[step.kind]}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          {step.comments > 0 && (
            <span className="flex h-5 items-center gap-1 rounded-full bg-primary px-1.5 font-mono text-[10px] font-semibold text-primary-foreground">
              <MessageSquare className="size-2.5" />
              {step.comments}
            </span>
          )}
        </span>
      </div>
      <div className="mt-2 px-0.5">
        <div className="text-[13px] font-semibold tracking-tight">{step.title}</div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
          {step.subtitle}
        </div>
      </div>
      {step.proto && step.state && (
        <div className="mt-2.5 overflow-hidden rounded-lg border border-border">
          <LivePreview
            src={previewUrl(step.proto, step.state)}
            title={`${step.title} preview`}
            scale={226 / 720}
            width={720}
            height={420}
          />
        </div>
      )}
      {step.uncovered && (
        <div className="mt-2 flex items-center gap-1.5 rounded-md bg-[color-mix(in_oklch,var(--tone-warning)_12%,transparent)] px-2 py-1 text-[11px] text-[var(--tone-warning)]">
          <TriangleAlert className="size-3" />
          State "All done" is in no flow
        </div>
      )}
      <Handle type="source" position={Position.Right} className={cn(lit && "is-lit")} />
      <Handle id="bottom" type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}

/** A transition: dash pattern by kind, the trigger as a label, pink on the selected path. */
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

function FlowSurface({ selected, tool }: { selected?: string; tool: "select" | "comment" }) {
  const dark = useShellTheme() === "dark";
  const lit = new Set<string>();
  for (const link of flow.links) {
    if (link.from === selected || link.to === selected) lit.add(`${link.from}->${link.to}`);
  }
  const initial: StepNode[] = flow.steps.map(step => ({
    id: step.id,
    type: "step",
    position: { x: step.x, y: step.y },
    data: {
      step,
      selected: step.id === selected,
      lit: flow.links.some(
        l => (l.from === selected || l.to === selected) && (l.from === step.id || l.to === step.id)
      ),
    },
  }));
  const [nodes, , onNodesChange] = useNodesState(initial);
  const x = (id: string) => flow.steps.find(step => step.id === id)?.x ?? 0;
  const edges: LinkEdge[] = flow.links.map(link => ({
    id: `${link.from}->${link.to}`,
    type: "link",
    source: link.from,
    target: link.to,
    // Back edges loop under the cards instead of crossing the graph.
    ...(x(link.to) < x(link.from) && { sourceHandle: "bottom", targetHandle: "bottom-in" }),
    ...(x(link.to) === x(link.from) && { sourceHandle: "bottom", targetHandle: "top" }),
    data: { on: link.on, kind: link.kind, lit: lit.has(`${link.from}->${link.to}`) },
  }));
  return (
    <ReactFlow
      nodes={nodes}
      onNodesChange={onNodesChange}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={{ padding: 0.14 }}
      minZoom={0.3}
      nodesDraggable={false}
      proOptions={{ hideAttribution: true }}
    >
      <Panel position="top-left" className="!m-4">
        <div className="flex items-center gap-0.5 rounded-xl border border-border bg-[var(--shell-panel)] p-1">
          {[
            { id: "select", icon: MousePointer2, label: "Select" },
            { id: "hand", icon: Hand, label: "Pan" },
            { id: "comment", icon: MessageSquarePlus, label: "Comment (C)" },
          ].map(item => (
            <Button
              key={item.id}
              variant="ghost"
              size="icon-sm"
              aria-label={item.label}
              className={cn(item.id === tool && "bg-[var(--shell-primary-soft)] text-primary")}
            >
              <item.icon />
            </Button>
          ))}
        </div>
      </Panel>
      <Panel
        position="top-right"
        className="!m-4 hidden items-center gap-4 font-mono text-[10.5px] whitespace-nowrap text-muted-foreground 2xl:flex"
      >
        <Legend dash={undefined} label="navigates" />
        <Legend dash="5 4" label="same screen" />
        <Legend dash="1.5 4" label="redirect" />
        <Legend dash="7 3" label="leaves the app" />
      </Panel>
      <Panel position="bottom-left" className="!m-4">
        <div className="flex h-9 items-center gap-1 rounded-xl border border-border bg-[var(--shell-panel)] px-1.5 text-[13px]">
          <Button variant="ghost" size="icon-xs" aria-label="Zoom out">
            <Minus />
          </Button>
          <span className="w-10 text-center font-medium tabular-nums">86%</span>
          <Button variant="ghost" size="icon-xs" aria-label="Zoom in">
            <Plus />
          </Button>
          <span className="mx-1 h-4 w-px bg-border" />
          <Button
            variant="ghost"
            size="xs"
            aria-label="Auto-layout"
            className="text-muted-foreground"
          >
            <Maximize2 data-icon="inline-start" />
            <span className="hidden xl:inline">Auto-layout</span>
          </Button>
        </div>
      </Panel>
      <Panel position="bottom-center" className="!mb-4 hidden xl:block">
        <div className="flex h-9 items-center gap-3 rounded-xl border border-border bg-[var(--shell-panel)] px-3.5 text-xs whitespace-nowrap text-muted-foreground">
          <span>
            <b className="font-semibold text-foreground">6</b> steps
          </span>
          <span className="h-3.5 w-px bg-border" />
          <span>
            <b className="font-semibold text-foreground">8</b> transitions
          </span>
          <span className="h-3.5 w-px bg-border" />
          <span className="text-[var(--tone-warning)]">1 state uncovered</span>
        </div>
      </Panel>
      <MiniMap
        position="bottom-right"
        pannable
        zoomable
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

function Legend({ dash: pattern, label }: { dash?: string; label: string }) {
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

/** The flow canvas: dotted surface, step cards with live previews and the review tools. */
export function FlowCanvas({
  selected,
  tool = "select",
}: {
  selected?: string;
  tool?: "select" | "comment";
}) {
  return (
    <div className="shell-dots relative min-h-0 flex-1">
      <ReactFlowProvider>
        <FlowSurface selected={selected} tool={tool} />
      </ReactFlowProvider>
    </div>
  );
}
