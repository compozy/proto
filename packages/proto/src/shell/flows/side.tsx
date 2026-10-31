/**
 * Side panel of a flow: tabs between the selected step ("Step", the inspector) and the flow's
 * review comments ("Comments", `?comments=1`). Comments are written here about the selected
 * step, or the whole flow when none is selected; selecting one moves the canvas to its step.
 */
import { PanelRightIcon } from "@proto/ui/lib/icons";

import { Button } from "@proto/ui/components/button";
import { Tabs, TabsList, TabsTrigger } from "@proto/ui/components/tabs";

import { flowKey, type FlowEntry, type ResolvedNode } from "../../flow";
import { commentsApi, commentsAvailable } from "../comments/api";
import { FlowComposer } from "../comments/flow-composer";
import type { NodeTarget, ReviewComment } from "../comments/model";
import { CommentsPanel } from "../comments/panel";
import { FlowInspector } from "./inspector";
import { stepLabel } from "./node-model";
import type { Registry } from "../registry-model";
import { updateView } from "../view";

type FlowSideProps = {
  flow: FlowEntry;
  node: ResolvedNode | null;
  registry: Registry;
  comments: ReviewComment[];
  /** Comments tab on screen (`?comments=1`). */
  panel: boolean;
  onPanelChange: (panel: boolean) => void;
  selectedComment: string | null;
  theme: string | null;
  onSelectNode: (id: string) => void;
  /** Collapses the whole side panel. */
  onClose: () => void;
};

export function FlowSide(props: FlowSideProps) {
  const { flow, node, comments } = props;
  const key = flowKey(flow.id);
  const open = comments.filter(comment => comment.status === "open").length;
  const target: NodeTarget = {
    kind: "node",
    node: node?.id ?? null,
    label: node ? stepLabel(node) : "",
  };

  const create = async (body: string, attachments: string[]) => {
    const created = await commentsApi.create(key, {
      body,
      attachments,
      target,
      context: {
        state: node?.id ?? "",
        theme: props.theme === "light" || props.theme === "dark" ? props.theme : null,
        role: null,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      },
    });
    updateView({ comment: created.id, panel: true });
  };

  const selectComment = (comment: ReviewComment | null) => {
    if (!comment) {
      updateView({ comment: null });
      return;
    }
    updateView({ comment: comment.id, panel: true, node: comment.context.state || null });
  };

  return (
    <aside
      className="flex h-full w-full flex-col gap-3 overflow-hidden rounded-[20px] bg-card p-3"
      aria-label="Flow panel"
      data-testid="flow-side"
    >
      <div className="flex items-center gap-2">
        <Tabs
          value={props.panel ? "comments" : "step"}
          onValueChange={(value: string) => props.onPanelChange(value === "comments")}
          className="flex-1"
        >
          <TabsList aria-label="Flow panel" className="w-full">
            <TabsTrigger value="step" data-testid="flow-tab-step">
              Step
            </TabsTrigger>
            {commentsAvailable ? (
              <TabsTrigger value="comments" data-testid="flow-tab-comments">
                Comments
                <span className="font-mono text-[11px] text-muted-foreground">{open}</span>
              </TabsTrigger>
            ) : null}
          </TabsList>
        </Tabs>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={props.onClose}
          aria-label="Collapse panel"
          data-testid="flow-side-close"
        >
          <PanelRightIcon />
        </Button>
      </div>
      {props.panel ? (
        <CommentsPanel
          slug={key}
          kind="flow"
          heading={false}
          comments={comments}
          places={flow.nodes.map(item => ({ id: item.id, label: stepLabel(item) }))}
          place={node?.id ?? ""}
          selectedId={props.selectedComment}
          onSelect={selectComment}
          onClose={() => props.onPanelChange(false)}
          composer={
            <FlowComposer
              key={`${key}:${target.node}`}
              slug={key}
              target={target}
              onSubmit={create}
            />
          }
          className="rounded-none bg-transparent p-0"
        />
      ) : (
        <div
          className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-1"
          data-testid="flow-inspector"
        >
          <FlowInspector
            flow={flow}
            node={node}
            registry={props.registry}
            onSelectNode={props.onSelectNode}
          />
        </div>
      )}
    </aside>
  );
}
