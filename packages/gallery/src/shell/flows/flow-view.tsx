/**
 * Flow canvas (`?flow=`): a read-only React Flow view of one flow with the ELK layout, legend,
 * warnings, zoom and the side panel (selected step and the flow's comments; resizable and
 * collapsible from 768 px, a bottom sheet below). Steps show their open comment counts.
 * Selection lives in the URL (`?node=`): click or Enter selects, double-click or Shift+Enter opens
 * the prototype, Escape or a click on the empty canvas clears it.
 */
import "@xyflow/react/dist/style.css";

import { useEffect, useEffectEvent, useRef, useState, type KeyboardEvent } from "react";
import {
  Background,
  BackgroundVariant,
  getViewportForBounds,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeChange,
} from "@xyflow/react";

import { Sheet, SheetContent, SheetTitle } from "@proto/ui/components/sheet";
import { useIsMobile } from "@proto/ui/hooks/use-mobile";

import type { FlowEntry, ResolvedNode } from "../../flow";
import type { ReviewComment } from "../comments/model";
import { FlowLegend, FlowWarnings, LayoutStatusRegion, ZoomControls } from "./chrome";
import { edgeLabelClass, viewportDuration } from "./edge-style";
import { FlowEdgeView, FlowMarkers, type FlowEdgeType } from "./flow-edge";
import { nodeName, openNode } from "./node-model";
import {
  ExternalNodeView,
  PrototypeNodeView,
  type ExternalNodeType,
  type PrototypeNodeType,
} from "./nodes";
import { PreviewQueue } from "./previews";
import { FlowSide } from "./side";
import { edgeId, useFlowLayout } from "./use-layout";
import { flowWarnings, type Registry } from "../registry-model";
import { WithSidePanel } from "../side-panel";
import { updateView } from "../view";

type Size = { width: number; height: number };

type FlowViewProps = {
  flow: FlowEntry;
  node: string | null;
  registry: Registry;
  theme: string | null;
  comments: ReviewComment[];
  /** Comments tab of the side panel (`?comments=1`) and the focused comment. */
  panel: boolean;
  comment: string | null;
  /** Side panel shown (from 768 px). */
  side: boolean;
  onSide: (open: boolean) => void;
};

const nodeTypes = { prototype: PrototypeNodeView, external: ExternalNodeView };
const edgeTypes = { flow: FlowEdgeView };
const minZoom = 0.05;

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width: Math.round(width), height: Math.round(height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

/** Measures every edge label with the canvas markup, so ELK reserves their real size. */
function LabelMeasurer({
  flow,
  onSizes,
}: {
  flow: FlowEntry;
  onSizes: (sizes: Record<string, Size>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const measure = () => {
      const sizes: Record<string, Size> = {};
      ref.current?.querySelectorAll<HTMLElement>("[data-edge]").forEach(element => {
        sizes[element.dataset.edge ?? ""] = {
          width: Math.ceil(element.offsetWidth),
          height: Math.ceil(element.offsetHeight),
        };
      });
      onSizes(sizes);
    };
    measure();
    // Labels widen once Plus Jakarta Sans loads; measure again then.
    void document.fonts.ready.then(measure);
  }, [flow, onSizes]);
  return (
    <div
      ref={ref}
      className="invisible absolute top-0 left-0 -z-10 flex flex-col items-start"
      aria-hidden
    >
      {flow.edges.map((edge, index) => (
        <span key={edgeId(index)} data-edge={edgeId(index)} className={edgeLabelClass}>
          {edge.on}
        </span>
      ))}
    </div>
  );
}

type Layout = ReturnType<typeof useFlowLayout>["layout"];

/** The steps linked to the selected one (itself included); the others are dimmed. */
function relatedTo(flow: FlowEntry, selected: ResolvedNode | null) {
  const related = new Set<string>();
  if (!selected) return related;
  related.add(selected.id);
  for (const edge of flow.edges) {
    if (edge.from === selected.id) related.add(edge.to);
    if (edge.to === selected.id) related.add(edge.from);
  }
  return related;
}

function flowNodes({
  flow,
  layout,
  nodeSizes,
  selected,
  theme,
  comments,
}: {
  flow: FlowEntry;
  layout: Layout;
  nodeSizes: Record<string, Size>;
  selected: ResolvedNode | null;
  theme: string | null;
  comments: ReviewComment[];
}): (PrototypeNodeType | ExternalNodeType)[] {
  const related = relatedTo(flow, selected);
  return flow.nodes.map(item => ({
    id: item.id,
    type: item.kind,
    position: layout?.nodes[item.id] ?? { x: 0, y: 0 },
    measured: nodeSizes[item.id],
    // Rendered hidden until laid out, so React Flow can measure them first.
    style: layout ? undefined : { visibility: "hidden" },
    className:
      "rounded-[14px] outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
    ariaLabel: `Step ${item.step} of ${flow.nodes.length}: ${nodeName(item)}${
      item.kind === "prototype" ? `, ${item.stateLabel}` : ""
    }${item.start ? ", start of the flow" : ""}${item.end ? ", end of the flow" : ""}`,
    data: {
      node: item,
      steps: flow.nodes.length,
      selected: item.id === selected?.id,
      dimmed: Boolean(selected) && !related.has(item.id),
      theme,
      comments: comments.filter(
        comment => comment.status === "open" && comment.context.state === item.id
      ).length,
    },
  }));
}

function flowEdges(flow: FlowEntry, layout: Layout, selected: ResolvedNode | null): FlowEdgeType[] {
  return flow.edges.map((edge, index) => {
    const highlighted =
      Boolean(selected) && (edge.from === selected?.id || edge.to === selected?.id);
    return {
      id: edgeId(index),
      source: edge.from,
      target: edge.to,
      type: "flow",
      hidden: !layout,
      focusable: false,
      selectable: false,
      zIndex: highlighted ? 1 : 0,
      data: {
        edge,
        route: layout?.edges[edgeId(index)] ?? null,
        highlighted,
        dimmed: Boolean(selected) && !highlighted,
      },
    };
  });
}

function FlowCanvas(props: FlowViewProps) {
  const { flow, node: selectedId, registry, theme, comments } = props;
  const { setViewport, setCenter, getZoom } = useReactFlow();
  const mobile = useIsMobile();
  const [containerRef, container] = useElementSize<HTMLDivElement>();
  const [nodeSizes, setNodeSizes] = useState<Record<string, Size>>({});
  const [labelSizes, setLabelSizes] = useState<Record<string, Size> | null>(null);
  const { status, layout, retry } = useFlowLayout({ flow, nodeSizes, labelSizes, container });
  const selected = flow.nodes.find(item => item.id === selectedId) ?? null;
  const warnings = flowWarnings(registry, flow);

  const nodes = flowNodes({ flow, layout, nodeSizes, selected, theme, comments });
  const edges = flowEdges(flow, layout, selected);

  const onNodesChange = (changes: NodeChange[]) => {
    const measured = changes.flatMap(change =>
      change.type === "dimensions" && change.dimensions
        ? [{ id: change.id, ...change.dimensions }]
        : []
    );
    if (measured.length === 0) return;
    setNodeSizes(current => {
      const next = { ...current };
      for (const { id, width, height } of measured) next[id] = { width, height };
      return next;
    });
  };

  const focusOn = (id: string | null) => {
    const target = id ? flow.nodes.find(item => item.id === id) : null;
    const position = target ? layout?.nodes[target.id] : null;
    const size = target ? nodeSizes[target.id] : null;
    if (position && size) {
      void setCenter(position.x + size.width / 2, position.y + size.height / 2, {
        zoom: Math.max(getZoom(), 0.8),
        duration: viewportDuration(),
      });
    } else if (layout) {
      // ELK's bounds include routed edges and labels that extend beyond the node cards.
      const viewport = getViewportForBounds(
        { x: 0, y: 0, width: layout.width, height: layout.height },
        container.width,
        container.height,
        minZoom,
        1,
        { top: "64px", bottom: "56px", left: "24px", right: "24px" }
      );
      void setViewport(viewport, { duration: viewportDuration() });
    }
  };

  // Only a new layout (first one, resize, remeasure) moves the viewport, to the selected node or
  // the whole flow; selecting on the canvas does not.
  const frameLayout = useEffectEvent(() => focusOn(selectedId));
  useEffect(() => {
    if (!layout) return;
    const frame = requestAnimationFrame(() => frameLayout());
    return () => cancelAnimationFrame(frame);
  }, [layout]);

  const selectNode = (id: string | null) => updateView({ node: id });
  const goToNode = (id: string) => {
    selectNode(id);
    focusOn(id);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && selected) {
      event.preventDefault();
      selectNode(null);
      return;
    }
    if (event.key !== "Enter") return;
    const element = (event.target as HTMLElement).closest<HTMLElement>(".react-flow__node");
    const target = flow.nodes.find(item => item.id === element?.dataset.id);
    if (!target) return;
    event.preventDefault();
    if (event.shiftKey) openNode(target);
    else selectNode(target.id);
  };

  const closeMobilePanel = () => updateView({ node: null, panel: false, comment: null });

  const side = (
    <FlowSide
      flow={flow}
      node={selected}
      registry={registry}
      comments={comments}
      panel={props.panel}
      onPanelChange={panel => {
        props.onSide(true);
        updateView({ panel, comment: null });
      }}
      selectedComment={props.comment}
      theme={theme}
      onSelectNode={goToNode}
      onClose={() => (mobile ? closeMobilePanel() : props.onSide(false))}
    />
  );

  const canvas = (
    <div className="flex min-h-0 min-w-0 flex-1" data-testid="flow-view" data-flow={flow.id}>
      <div
        ref={containerRef}
        className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-[20px] bg-sidebar"
        onKeyDown={onKeyDown}
        data-layout-status={status}
        data-testid="flow-canvas"
      >
        <FlowMarkers />
        <LabelMeasurer flow={flow} onSizes={setLabelSizes} />
        <PreviewQueue ready={Boolean(layout)}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onNodeClick={(_, item) => selectNode(item.id)}
            onNodeDoubleClick={(_, item) => {
              const target = flow.nodes.find(node => node.id === item.id);
              if (target) openNode(target);
            }}
            onPaneClick={() => selectNode(null)}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            edgesFocusable={false}
            zoomOnDoubleClick={false}
            deleteKeyCode={null}
            selectionKeyCode={null}
            multiSelectionKeyCode={null}
            minZoom={minZoom}
            maxZoom={1.6}
            attributionPosition="bottom-left"
            className="[--xy-background-color:transparent]"
            aria-label={`Flow ${flow.title}`}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={18}
              size={1.2}
              color="var(--color-border)"
            />
          </ReactFlow>
        </PreviewQueue>
        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-3">
          <FlowLegend />
          <FlowWarnings warnings={warnings} />
        </div>
        <div className="pointer-events-none absolute right-3 bottom-3">
          <ZoomControls onFit={() => focusOn(null)} />
        </div>
        {layout && status !== "failed" ? null : (
          <LayoutStatusRegion status={status} onRetry={retry} />
        )}
      </div>
    </div>
  );

  if (!mobile) {
    return (
      <WithSidePanel id="flow" label="Flow panel width" side={props.side ? side : null}>
        {canvas}
      </WithSidePanel>
    );
  }
  return (
    <>
      {canvas}
      <Sheet
        open={Boolean(selected) || props.panel}
        onOpenChange={open => {
          if (!open) closeMobilePanel();
        }}
      >
        <SheetContent side="bottom" className="h-[75dvh] gap-0 rounded-t-[20px] border-0 p-0">
          <SheetTitle className="sr-only">Flow panel</SheetTitle>
          {side}
        </SheetContent>
      </Sheet>
    </>
  );
}

export function FlowView(props: FlowViewProps) {
  return (
    // A new flow starts from scratch: no positions, sizes or viewport of the previous one.
    <ReactFlowProvider key={props.flow.id}>
      <FlowCanvas {...props} />
    </ReactFlowProvider>
  );
}
