/**
 * A flow edge drawn on the ELK route (orthogonal sections, rounded at the bends) with its trigger
 * label at the position ELK reserved for it. The kind is the line pattern; the selected node's
 * edges switch to the focus color.
 */
import { BaseEdge, EdgeLabelRenderer, type Edge, type EdgeProps } from "@xyflow/react";

import { cn } from "@proto/ui/lib/utils";

import type { ResolvedEdge } from "../../flow";
import { edgeKindStyle, edgeLabelClass, roundedPath } from "./edge-style";
import type { EdgeRoute } from "./layout-state";

export type FlowEdgeData = {
  edge: ResolvedEdge;
  route: EdgeRoute | null;
  highlighted: boolean;
  dimmed: boolean;
};
export type FlowEdgeType = Edge<FlowEdgeData, "flow">;

const arrow = "flow-arrow";
const arrowHighlighted = "flow-arrow-highlighted";

export function FlowEdgeView({ id, data }: EdgeProps<FlowEdgeType>) {
  if (!data?.route) return null;
  const { edge, route, highlighted, dimmed } = data;
  const style = edgeKindStyle[edge.kind];
  const label = route.label;
  return (
    <>
      <BaseEdge
        id={id}
        path={roundedPath(route.points)}
        markerEnd={`url(#${highlighted ? arrowHighlighted : arrow})`}
        interactionWidth={0}
        style={{
          stroke: highlighted ? "var(--color-ring)" : "var(--color-muted-foreground)",
          strokeWidth: highlighted ? 2.2 : 1.6,
          strokeDasharray: style.dash,
          strokeLinecap: style.round ? "round" : undefined,
          opacity: dimmed ? 0.4 : 1,
        }}
      />
      {label ? (
        <EdgeLabelRenderer>
          <div
            className={cn(
              edgeLabelClass,
              "nodrag nopan pointer-events-none absolute top-0 left-0 bg-sidebar text-center",
              highlighted ? "text-ring" : "text-muted-foreground",
              dimmed && "opacity-40"
            )}
            style={{
              transform: `translate(${label.x}px, ${label.y}px)`,
              width: label.width,
              height: label.height,
            }}
            data-testid="flow-edge-label"
          >
            {edge.on}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

/** Arrowheads for both edge states; rendered once per canvas. */
export function FlowMarkers() {
  return (
    <svg className="absolute size-0" aria-hidden>
      <defs>
        {[
          { id: arrow, fill: "var(--color-muted-foreground)" },
          { id: arrowHighlighted, fill: "var(--color-ring)" },
        ].map(marker => (
          <marker
            key={marker.id}
            id={marker.id}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0 0L10 5L0 10z" style={{ fill: marker.fill }} />
          </marker>
        ))}
      </defs>
    </svg>
  );
}
