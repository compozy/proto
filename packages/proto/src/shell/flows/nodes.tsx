/**
 * Flow node cards. A prototype node shows its title, owning spec, a fixed 16:10 preview area and
 * its route and state; the canvas preview queue (`previews.tsx`) decides when the live preview
 * mounts. An external node never embeds its page: dashed outline (not ours), service initial,
 * label and URL. Node size never depends on zoom or preview state, so the layout stays stable.
 */
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { MessageSquareIcon } from "@proto/ui/lib/icons";

import { cn } from "@proto/ui/lib/utils";

import { externalLabels, type ResolvedNode } from "../../flow";
import { displayUrl, externalName } from "./node-model";
import { PreviewFrame } from "./preview-frame";
import { usePreview } from "./previews";
import { frameSrc } from "../view";

export type FlowNodeData = {
  node: ResolvedNode;
  steps: number;
  selected: boolean;
  dimmed: boolean;
  theme: string | null;
  /** Open review comments on this step. */
  comments: number;
};
export type PrototypeNodeType = Node<FlowNodeData, "prototype">;
export type ExternalNodeType = Node<FlowNodeData, "external">;

function NodeComments({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      className="flex shrink-0 items-center gap-0.5 font-mono text-[10px] text-primary dark:text-accent-foreground"
      title={`${count} ${count === 1 ? "open comment" : "open comments"}`}
      data-testid="flow-node-comments"
    >
      <MessageSquareIcon className="size-3" aria-hidden />
      {count}
    </span>
  );
}

/** Card width at 100 %; the preview area keeps 16:10 of a 1440 px page. */
const cardWidth = 240;
const previewWidth = cardWidth - 16;
const previewHeight = Math.round((previewWidth * 10) / 16);

/** Handles exist only because React Flow anchors edges to them; ELK owns the routes. */
function Anchors() {
  return (
    <>
      <Handle type="target" position={Position.Left} isConnectable={false} className="invisible" />
      <Handle type="source" position={Position.Right} isConnectable={false} className="invisible" />
    </>
  );
}

function Tags({ node }: { node: ResolvedNode }) {
  return (
    <>
      {node.start ? (
        <span className="absolute -top-2 -left-2 rounded-[6px] bg-foreground px-1.5 font-mono text-[10px] leading-4 font-medium text-background">
          start
        </span>
      ) : null}
      {node.end ? (
        <span className="absolute -top-2 -right-2 rounded-[6px] bg-primary px-1.5 font-mono text-[10px] leading-4 font-medium text-primary-foreground">
          end
        </span>
      ) : null}
    </>
  );
}

export function PrototypeNodeView({ data }: NodeProps<PrototypeNodeType>) {
  const node = data.node;
  if (node.kind !== "prototype") return null;
  const src = frameSrc(node.proto, {
    state: node.state,
    theme: data.theme,
    role: node.role ?? null,
  });
  return <PrototypeCard node={node} src={src} data={data} />;
}

function PrototypeCard({
  node,
  src,
  data,
}: {
  node: Extract<ResolvedNode, { kind: "prototype" }>;
  src: string;
  data: FlowNodeData;
}) {
  const preview = usePreview(node.id, src);
  return (
    <div
      className={cn(
        "relative rounded-[14px] bg-card p-2 text-card-foreground [contain:layout_style] transition-opacity duration-200 motion-reduce:transition-none",
        data.dimmed && "opacity-40",
        data.selected && "outline-2 outline-offset-2 outline-ring"
      )}
      style={{ width: cardWidth }}
      data-testid="flow-node"
      data-node={node.id}
    >
      <Anchors />
      <Tags node={node} />
      <div className="flex items-baseline justify-between gap-2 px-0.5 pb-1.5">
        <span className="min-w-0 flex-1 truncate text-[12px] leading-4 font-medium">
          {node.title}
        </span>
        <NodeComments count={data.comments} />
        {node.spec ? (
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{node.spec}</span>
        ) : null}
      </div>
      {/* Fixed size: the preview's layout and paint never leave this box. */}
      <div
        className="relative overflow-hidden rounded-[8px] bg-background [contain:strict]"
        style={{ width: previewWidth, height: previewHeight }}
      >
        {preview.mounted ? (
          <PreviewFrame
            key={src}
            src={src}
            title={`${node.title} · ${node.stateLabel}`}
            width={previewWidth}
            height={previewHeight}
            onSettle={preview.onSettle}
          />
        ) : (
          <div className="flex h-full flex-col justify-center gap-1 px-3 text-center">
            <span className="text-[13px] leading-snug">{node.stateLabel}</span>
            <span className="font-mono text-[10.5px] text-muted-foreground">
              step {node.step} of {data.steps}
            </span>
          </div>
        )}
      </div>
      <div className="flex justify-between gap-2 px-0.5 pt-1.5 font-mono text-[10.5px] leading-4">
        <span className="truncate text-muted-foreground">{node.route}</span>
        <span className="shrink-0 text-primary dark:text-accent-foreground">{node.state}</span>
      </div>
    </div>
  );
}

export function ExternalNodeView({ data }: NodeProps<ExternalNodeType>) {
  const node = data.node;
  if (node.kind !== "external") return null;
  const name = externalName(node);
  const service = externalLabels[node.external];
  return (
    <div
      className={cn(
        "relative flex w-[200px] flex-col gap-1 rounded-[14px] border-[1.5px] border-dashed border-foreground/25 bg-sidebar p-3 transition-opacity duration-200 motion-reduce:transition-none",
        data.dimmed && "opacity-40",
        data.selected && "outline-2 outline-offset-2 outline-ring"
      )}
      data-testid="flow-node"
      data-node={node.id}
    >
      <Anchors />
      <Tags node={node} />
      <span
        className="mb-1 grid size-7 place-items-center rounded-[10px] bg-muted font-mono text-xs font-medium"
        aria-hidden
      >
        {(service || name).charAt(0).toUpperCase()}
      </span>
      <span className="flex items-baseline justify-between gap-2 text-[13px] leading-snug">
        {name}
        <NodeComments count={data.comments} />
      </span>
      <span className="text-[12px] text-muted-foreground">
        {service && service !== name ? `${service} · outside the app` : "outside the app"}
      </span>
      {node.url ? (
        <span className="truncate font-mono text-[10.5px] text-muted-foreground">
          {displayUrl(node.url)}
        </span>
      ) : null}
    </div>
  );
}
