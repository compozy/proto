/** S4 flow canvas with the S5 step inspector (flow summary when nothing is selected). */
import { useState } from "react";

import type { RegistryFlow, ResolvedNode } from "../../model/registry";
import {
  Fact,
  Facts,
  Inspector,
  Section,
  ShellSubHeader,
  StateDot,
  useInspector,
  type ViewTab,
} from "../app/chrome";
import { Link } from "../app/link";
import { useSlots, type InspectorTab, type ReviewTarget } from "../app/slots";
import { Preview } from "../frames/preview";
import { useT } from "../lib/i18n";
import { go } from "../lib/navigation";
import {
  displayUrl,
  flowCoverage,
  flowProblems,
  nodeTitle,
  orderedSteps,
  padNumber,
  stepKind,
} from "../lib/registry-model";
import { useRegistry, useShellData } from "../lib/shell-data";
import { useShortcuts } from "../lib/shortcuts";
import { flowKey } from "../../model/registry";
import { screenView } from "../lib/view";
import { Button } from "../ui/button";
import { ArrowRight, ExternalLink } from "../ui/icons";
import { FlowCanvas } from "./flow-canvas";

export function FlowPage({
  flow,
  node,
  theme,
}: {
  flow: RegistryFlow;
  node: string | null;
  theme: "light" | "dark";
}) {
  const t = useT();
  const registry = useRegistry();
  const { bootstrap } = useShellData();
  const slots = useSlots();
  const inspector = useInspector();
  const [tab, setTab] = useState("step");
  const selected = flow.nodes.find(item => item.id === node) ?? null;
  const target: ReviewTarget = {
    kind: "flow",
    key: flowKey(flow.id),
    flow: flow.id,
    node: selected?.id ?? null,
  };
  const problems = flowProblems(registry, flow.id);
  const coverage = flowCoverage(registry, flow);
  const uncovered = new Map<string, string[]>();
  for (const warning of coverage) {
    if (!warning.proto || !warning.state) continue;
    const prototype = registry.prototypes.find(item => item.slug === warning.proto);
    const label =
      prototype?.states.find(state => state.id === warning.state)?.label ?? warning.state;
    uncovered.set(warning.proto, [...(uncovered.get(warning.proto) ?? []), label]);
  }
  const select = (id: string | null) =>
    go({ area: "flow", flow: flow.id, node: id }, { replace: true });
  const screenNode =
    selected?.kind === "prototype"
      ? selected
      : orderedSteps(flow).find(item => item.kind === "prototype");
  const openView = (view: ViewTab) => {
    if (view === "flow" || !screenNode || screenNode.kind !== "prototype") return;
    go(
      screenView(screenNode.proto, screenNode.state, {
        role: screenNode.role ?? null,
        compare: view === "compare",
      })
    );
  };
  const steps = orderedSteps(flow).filter(item => item.step > 0);
  const walk = (delta: number) => {
    const index = steps.findIndex(item => item.id === selected?.id);
    const next = steps[index < 0 ? 0 : index + delta];
    if (next) select(next.id);
  };
  useShortcuts({
    j: () => walk(-1),
    k: () => walk(1),
    "2": () => openView("screen"),
    "3": () => openView("compare"),
  });

  const meta = [t("count.steps", { count: flow.steps }), bootstrap.commit?.slice(0, 7)]
    .filter(Boolean)
    .join(" · ");
  const extra = slots.inspectorTabs?.(target) ?? [];
  const tabs: InspectorTab[] = selected
    ? [
        {
          id: "step",
          label: t("inspector.step"),
          content: <StepPanel flow={flow} node={selected} theme={theme} />,
        },
        ...extra,
        {
          id: "source",
          label: t("inspector.source"),
          content: <FlowSource flow={flow} node={selected} />,
        },
      ]
    : [
        {
          id: "step",
          label: t("inspector.flow"),
          content: (
            <FlowSummary flow={flow} uncovered={coverage.length} uncoveredLabels={uncovered} />
          ),
        },
        ...extra,
      ];

  return (
    <>
      <ShellSubHeader
        title={t("flow.title", { title: flow.title })}
        status={slots.reviewStatus?.(target)}
        meta={meta}
        view="flow"
        views={screenNode ? ["flow", "screen", "compare"] : ["flow"]}
        onView={openView}
        theme={theme}
        panel={inspector.panel}
      />
      <div className="relative flex min-h-0 flex-1">
        <section aria-label={t("flow.canvas")} className="flex min-h-0 min-w-0 flex-1">
          <FlowCanvas
            flow={flow}
            selected={selected?.id ?? null}
            onSelect={select}
            problems={problems}
            uncovered={uncovered}
            theme={theme}
            tools={slots.canvasTools?.(target)}
          />
        </section>
        <Inspector
          title={selected ? nodeTitle(selected) : t("flow.title", { title: flow.title })}
          eyebrow={
            selected
              ? `${t(`kind.${stepKind(flow, selected)}`)}${selected.step ? ` · ${t("flow.step", { step: selected.step })}` : ""}`
              : [t("inspector.flow"), flow.spec].filter(Boolean).join(" · ")
          }
          tabs={tabs}
          tab={tab}
          onTab={setTab}
          open={inspector.open}
          onClose={inspector.close}
          footer={selected ? <StepFooter node={selected} /> : undefined}
        />
      </div>
    </>
  );
}

/** Step tab: the live state, its facts and how people reach it and leave it. */
function StepPanel({
  flow,
  node,
  theme,
}: {
  flow: RegistryFlow;
  node: ResolvedNode;
  theme: "light" | "dark";
}) {
  const t = useT();
  const title = (id: string) => {
    const found = flow.nodes.find(item => item.id === id);
    return found ? nodeTitle(found) : id;
  };
  const incoming = flow.edges.filter(edge => edge.to === node.id);
  const outgoing = flow.edges.filter(edge => edge.from === node.id);
  return (
    <>
      {node.kind === "prototype" ? (
        <>
          <Section title={t("inspector.preview")} aside={t("inspector.followsTheme")}>
            <div className="overflow-hidden rounded-lg border border-border">
              <Preview
                key={`${node.proto}-${node.state}`}
                target={{ slug: node.proto, state: node.state, theme, role: node.role ?? null }}
                title={t("preview.of", { title: `${node.title} · ${node.stateLabel}` })}
                width={960}
                height={600}
              />
            </div>
          </Section>
          <Section title={t("inspector.screen")}>
            <Facts>
              <Fact label={t("facts.prototype")} mono>
                {node.proto}
              </Fact>
              <Fact label={t("facts.route")} mono>
                {node.route || "/"}
              </Fact>
              <Fact label={t("facts.state")}>
                <StateDot>{node.stateLabel}</StateDot>
              </Fact>
              {node.role && <Fact label={t("facts.role")}>{node.role}</Fact>}
            </Facts>
          </Section>
        </>
      ) : (
        <Section title={t("inspector.external")}>
          <Facts>
            <Fact label={t("facts.service")}>{node.label}</Fact>
            <Fact label={t("facts.url")} mono>
              {node.url ? displayUrl(node.url) : "—"}
            </Fact>
          </Facts>
        </Section>
      )}
      <Section title={t("inspector.arrivesFrom")} aside={String(incoming.length)}>
        <Transitions
          flow={flow}
          direction="in"
          items={incoming.map(edge => ({
            on: edge.on,
            id: edge.from,
            title: title(edge.from),
            kind: edge.kind,
          }))}
        />
      </Section>
      <Section title={t("inspector.leadsTo")} aside={String(outgoing.length)}>
        <Transitions
          flow={flow}
          direction="out"
          items={outgoing.map(edge => ({
            on: edge.on,
            id: edge.to,
            title: title(edge.to),
            kind: edge.kind,
          }))}
        />
      </Section>
    </>
  );
}

function Transitions({
  flow,
  items,
  direction,
}: {
  flow: RegistryFlow;
  items: { on: string; id: string; title: string; kind: string }[];
  direction: "in" | "out";
}) {
  const t = useT();
  if (!items.length) return <p className="text-xs text-muted-foreground">{t("inspector.none")}</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map(item => (
        <li key={`${item.on}-${item.id}`}>
          <Link
            to={{ area: "flow", flow: flow.id, node: item.id }}
            className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-[13px] hover:border-primary/50"
          >
            {direction === "in" && <span className="truncate font-medium">{item.title}</span>}
            <span className="flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">
              {item.on}
              <ArrowRight className="size-3" />
            </span>
            {direction === "out" && <span className="truncate font-medium">{item.title}</span>}
            <span className="ml-auto hidden shrink-0 font-mono text-[10px] text-muted-foreground uppercase xl:inline">
              {t(`edge.${item.kind as "navigate" | "overlay" | "redirect" | "external"}`)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function StepFooter({ node }: { node: ResolvedNode }) {
  const t = useT();
  if (node.kind === "external") {
    if (!node.url) return null;
    return (
      <a
        href={node.url}
        target="_blank"
        rel="noreferrer noopener"
        className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted"
      >
        <ExternalLink className="size-4" />
        {t("flow.openUrl")}
      </a>
    );
  }
  return (
    <Button
      variant="outline"
      className="h-9 flex-1"
      onClick={() => go(screenView(node.proto, node.state, { role: node.role ?? null }))}
    >
      <ExternalLink data-icon="inline-start" />
      {t("flow.openScreen")}
    </Button>
  );
}

/** Flow tab with nothing selected: what the journey is, its size and its coverage. */
function FlowSummary({
  flow,
  uncovered,
  uncoveredLabels,
}: {
  flow: RegistryFlow;
  uncovered: number;
  uncoveredLabels: Map<string, string[]>;
}) {
  const t = useT();
  const registry = useRegistry();
  const screens = new Set(
    flow.nodes.flatMap(node => (node.kind === "prototype" ? [`${node.proto}:${node.state}`] : []))
  ).size;
  return (
    <>
      {flow.description && (
        <p className="mb-5 text-[13px] leading-relaxed text-foreground/85">{flow.description}</p>
      )}
      <dl className="mb-5 grid grid-cols-3 gap-2">
        {[
          { label: t("flow.summary.steps"), value: flow.nodes.length },
          { label: t("flow.summary.screens"), value: screens },
          { label: t("flow.summary.transitions"), value: flow.edges.length },
        ].map(item => (
          <div
            key={item.label}
            className="rounded-lg border border-border bg-background px-3 py-2.5"
          >
            <dt className="truncate text-[11px] text-muted-foreground">{item.label}</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>
      {uncovered > 0 && (
        <Section title={t("flow.coverage")} aside={t("count.warnings", { count: uncovered })}>
          <ul className="flex flex-col gap-1.5">
            {[...uncoveredLabels].map(([slug, labels]) => (
              <li
                key={slug}
                className="flex items-start gap-2 rounded-lg bg-[color-mix(in_oklch,var(--tone-warning)_12%,transparent)] px-3 py-2.5 text-[13px]"
              >
                <span className="font-mono text-[10.5px] tracking-wide text-[var(--tone-warning)] uppercase">
                  {t("flow.uncovered")}
                </span>
                <span className="text-foreground/85">
                  {registry.prototypes.find(item => item.slug === slug)?.title ?? slug} ·{" "}
                  {labels.join(", ")}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title={t("flow.summary.steps")} aside={String(flow.nodes.length)}>
        <ol className="flex flex-col gap-1">
          {orderedSteps(flow).map(node => (
            <li key={node.id}>
              <Link
                to={{ area: "flow", flow: flow.id, node: node.id }}
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] hover:bg-accent"
              >
                <span className="font-mono text-[10px] text-muted-foreground">
                  {node.step ? padNumber(node.step) : "—"}
                </span>
                <span className="flex-1 truncate">{nodeTitle(node)}</span>
                <span className="font-mono text-[10px] text-muted-foreground uppercase">
                  {t(`kind.${stepKind(flow, node)}`)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </Section>
    </>
  );
}

/** Source tab of a step: the flow file and the prototype it shows. */
function FlowSource({ flow, node }: { flow: RegistryFlow; node: ResolvedNode }) {
  const t = useT();
  const registry = useRegistry();
  const file =
    node.kind === "prototype"
      ? registry.prototypes.find(item => item.slug === node.proto)?.file
      : null;
  return (
    <>
      <Section title={t("inspector.flowFile")}>
        <code className="block truncate rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs">
          {flow.file}
        </code>
      </Section>
      {file && (
        <Section title={t("inspector.file")}>
          <code className="block truncate rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs">
            {file}
          </code>
        </Section>
      )}
    </>
  );
}
