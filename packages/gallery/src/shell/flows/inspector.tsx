/**
 * Node inspector: with nothing selected, the flow summary; with a node, how a person arrives
 * ("Arrives from"), where they can go ("Leads to"), the other flows using the same state
 * ("Also in") and the action that opens the prototype (or the external page).
 */
import type { ReactNode } from "react";
import { ExternalLinkIcon } from "@proto/ui/lib/icons";

import type { FlowEntry, ResolvedEdge, ResolvedNode } from "../../flow";
import { cn } from "@proto/ui/lib/utils";
import { buttonVariants } from "@proto/ui/components/button";

import { edgeKindStyle } from "./edge-style";
import { displayUrl, nodeName, openNode, prototypeSelection } from "./node-model";
import { flowById, occurrencesOf, type Registry } from "../registry-model";
import { plainClick, select, useSelectionHref } from "../view";

type InspectorProps = {
  flow: FlowEntry;
  node: ResolvedNode | null;
  registry: Registry;
  onSelectNode: (id: string) => void;
};

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
      {children}
    </span>
  );
}

function Well({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5 rounded-[14px] bg-muted p-3" aria-label={title}>
      <Eyebrow>{title}</Eyebrow>
      <ul className="flex flex-col gap-0.5">{children}</ul>
    </section>
  );
}

function Fixed({ children }: { children: ReactNode }) {
  return <li className="px-1.5 py-1 text-[13px] text-muted-foreground">{children}</li>;
}

function EdgeRow({
  edge,
  other,
  onSelect,
}: {
  edge: ResolvedEdge;
  other: ResolvedNode | undefined;
  onSelect: (id: string) => void;
}) {
  if (!other) return null;
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(other.id)}
        className="flex w-full flex-col rounded-[10px] px-1.5 py-1 text-left outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="text-[13px] leading-snug">
          {nodeName(other)}
          {other.kind === "prototype" ? (
            <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">
              {other.state}
            </span>
          ) : null}
        </span>
        <span className="text-[12px] text-muted-foreground">
          {edgeKindStyle[edge.kind].label} · {edge.on}
        </span>
      </button>
    </li>
  );
}

function FlowSummary({ flow, registry }: { flow: FlowEntry; registry: Registry }) {
  const specTitle = (id: string) => registry.specs[id] ?? id;
  return (
    <>
      <div className="flex flex-col gap-1">
        <Eyebrow>Flow</Eyebrow>
        <h2 className="text-[18px] leading-snug tracking-[-0.02em]">{flow.title}</h2>
        {flow.description ? (
          <p className="text-[13px] leading-relaxed text-muted-foreground">{flow.description}</p>
        ) : null}
      </div>
      <section className="flex flex-col gap-1.5 rounded-[14px] bg-muted p-3">
        <Eyebrow>Owner spec</Eyebrow>
        <span className="text-[13px]">{flow.spec ? specTitle(flow.spec) : "No spec"}</span>
        <Eyebrow>Crosses</Eyebrow>
        <span className="flex flex-wrap gap-1">
          {flow.specs.map(spec => (
            <span key={spec} className="rounded-[6px] bg-background px-2 py-0.5 text-[12px]">
              {specTitle(spec)}
            </span>
          ))}
        </span>
      </section>
      <p className="font-mono text-[12px] text-muted-foreground">
        {flow.nodes.length} {flow.nodes.length === 1 ? "step" : "steps"} · {flow.edges.length}{" "}
        {flow.edges.length === 1 ? "transition" : "transitions"}
      </p>
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        Select a step to see how people arrive at it and where it leads.
      </p>
    </>
  );
}

export function FlowInspector({ flow, node, registry, onSelectNode }: InspectorProps) {
  const hrefOf = useSelectionHref();
  if (!node) return <FlowSummary flow={flow} registry={registry} />;
  const byId = (id: string) => flow.nodes.find(item => item.id === id);
  const incoming = flow.edges.filter(edge => edge.to === node.id);
  const outgoing = flow.edges.filter(edge => edge.from === node.id);
  const elsewhere =
    node.kind === "prototype"
      ? occurrencesOf(registry, node.proto, node.state).filter(item => item.flow !== flow.id)
      : [];
  return (
    <>
      <div className="flex flex-col gap-1">
        <Eyebrow>
          Step {node.step} of {flow.nodes.length}
        </Eyebrow>
        <h2 className="text-[18px] leading-snug tracking-[-0.02em]">{nodeName(node)}</h2>
        <span className="font-mono text-[11.5px] break-all text-muted-foreground">
          {node.kind === "prototype"
            ? `${node.proto} · ${node.state} · ${node.route}`
            : node.url
              ? displayUrl(node.url)
              : "outside the app"}
        </span>
        {node.kind === "prototype" ? (
          <span className="text-[13px] text-muted-foreground">{node.stateLabel}</span>
        ) : null}
      </div>
      <Well title="Arrives from">
        {node.start ? <Fixed>Start of the flow</Fixed> : null}
        {incoming.map(edge => (
          <EdgeRow
            key={`${edge.from}:${edge.on}`}
            edge={edge}
            other={byId(edge.from)}
            onSelect={onSelectNode}
          />
        ))}
      </Well>
      <Well title="Leads to">
        {outgoing.map(edge => (
          <EdgeRow
            key={`${edge.to}:${edge.on}`}
            edge={edge}
            other={byId(edge.to)}
            onSelect={onSelectNode}
          />
        ))}
        {node.end ? <Fixed>End of the flow</Fixed> : null}
      </Well>
      {elsewhere.length > 0 ? (
        <Well title="Also in">
          {elsewhere.map(item => {
            const target = { kind: "flow", flow: item.flow, node: item.node } as const;
            return (
              <li key={`${item.flow}:${item.node}`}>
                <a
                  href={hrefOf(target)}
                  onClick={event => {
                    if (plainClick(event)) select(target);
                  }}
                  className="flex flex-col rounded-[10px] px-1.5 py-1 outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="text-[13px]">
                    {flowById(registry, item.flow)?.title ?? item.flow}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    step {item.step} of {item.steps}
                  </span>
                </a>
              </li>
            );
          })}
        </Well>
      ) : null}
      {node.kind === "prototype" ? (
        <>
          <a
            href={hrefOf(prototypeSelection(node))}
            onClick={event => {
              if (plainClick(event)) openNode(node);
            }}
            className={cn(buttonVariants({ size: "lg" }), "w-full")}
            data-testid="flow-open-prototype"
          >
            Open the prototype in this state
          </a>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Double-click the step or press Shift+Enter to do the same.
          </p>
        </>
      ) : node.url ? (
        <a
          href={node.url}
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "w-full")}
        >
          Open page
          <ExternalLinkIcon />
        </a>
      ) : null}
    </>
  );
}
