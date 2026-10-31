import { useState } from "react";

import type { RegistryFlow, RegistryPrototype } from "../../model/registry";
import { Preview } from "../frames/preview";
import { useT } from "../lib/i18n";
import { flowCoverage, padNumber, stepKind } from "../lib/registry-model";
import { useRegistry } from "../lib/shell-data";
import { screenView } from "../lib/view";
import { Badge } from "../ui/badge";
import { ArrowUpRight, Check, Copy, TriangleAlert, Workflow } from "../ui/icons";
import { cn } from "../ui/utils";
import { Link } from "./link";

/** A prototype as a card: live preview of its default state, identity and its state chips. */
export function ScreenCard({
  prototype,
  theme,
  order,
  showStates = true,
}: {
  prototype: RegistryPrototype;
  theme: "light" | "dark";
  order: number;
  showStates?: boolean;
}) {
  const t = useT();
  const first = prototype.states[0];
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border bg-[var(--shell-panel)] transition-colors focus-within:border-primary/60 hover:border-primary/50">
      <div className="border-b border-border">
        <Preview
          target={{ slug: prototype.slug, state: first.id, theme, role: null }}
          title={t("preview.of", { title: prototype.title })}
          order={order}
        />
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2">
          <h3 className="min-w-0 flex-1 truncate text-[14px] font-semibold">
            <Link
              to={screenView(prototype.slug)}
              className="outline-none after:absolute after:inset-0 after:content-['']"
            >
              {prototype.title}
            </Link>
          </h3>
          {prototype.kind === "draft" && (
            <Badge variant="outline" className="shrink-0 font-mono text-[10px] uppercase">
              {t("common.draft")}
            </Badge>
          )}
        </div>
        <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
          {[prototype.surface, prototype.route, prototype.slug].filter(Boolean).join(" · ")}
        </div>
        {showStates ? (
          <ul className="relative mt-3 flex flex-wrap gap-1.5">
            {prototype.states.map(state => (
              <li key={state.id}>
                <Link
                  to={screenView(prototype.slug, state.id)}
                  className="flex h-6 items-center rounded-md border border-border bg-background px-2 text-[11.5px] whitespace-nowrap hover:border-primary/50 hover:text-primary"
                >
                  {state.label}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {t("count.states", { count: prototype.states.length })}
          </p>
        )}
      </div>
    </article>
  );
}

/** A journey as a row: title, spec, step count and coverage warnings. */
export function JourneyRow({ flow, specLabel }: { flow: RegistryFlow; specLabel?: string }) {
  const t = useT();
  const registry = useRegistry();
  const uncovered = flowCoverage(registry, flow).length;
  const problems = registry.problems.filter(problem => problem.flow === flow.id).length;
  return (
    <Link
      to={{ area: "flow", flow: flow.id, node: null }}
      className="flex items-center gap-3 rounded-xl border border-border bg-[var(--shell-panel)] px-4 py-3 transition-colors hover:border-primary/50"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--shell-primary-soft)] text-primary">
        <Workflow className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold">{flow.title}</span>
        <span className="block truncate font-mono text-[11px] text-muted-foreground">
          {[specLabel, t("count.steps", { count: flow.steps })].filter(Boolean).join(" · ")}
          {uncovered > 0 && (
            <span className="text-[var(--tone-warning)]">
              {" · "}
              {t("count.uncovered", { count: uncovered })}
            </span>
          )}
          {problems > 0 && (
            <span className="text-destructive">
              {" · "}
              {t("count.problems", { count: problems })}
            </span>
          )}
        </span>
      </span>
      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

/** A journey with its steps as a strip of small previews (spec page). */
export function JourneyStrip({ flow, theme }: { flow: RegistryFlow; theme: "light" | "dark" }) {
  const t = useT();
  const registry = useRegistry();
  const uncovered = flowCoverage(registry, flow).length;
  const steps = [...flow.nodes].filter(node => node.step > 0).sort((a, b) => a.step - b.step);
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-[var(--shell-panel)]">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--shell-primary-soft)] text-primary">
          <Workflow className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-semibold">
            <Link to={{ area: "flow", flow: flow.id, node: null }} className="hover:text-primary">
              {flow.title}
            </Link>
          </h3>
          {flow.description && (
            <p className="truncate text-xs text-muted-foreground">{flow.description}</p>
          )}
        </div>
        {uncovered > 0 && (
          <span className="hidden shrink-0 items-center gap-1.5 rounded-md bg-[color-mix(in_oklch,var(--tone-warning)_12%,transparent)] px-2 py-1 text-[11px] text-[var(--tone-warning)] md:flex">
            <TriangleAlert className="size-3" />
            {t("count.uncovered", { count: uncovered })}
          </span>
        )}
        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
      </header>
      <ol className="flex gap-2 overflow-x-auto p-4 [scrollbar-width:thin]">
        {steps.map((node, index) => (
          <li key={node.id} className="flex shrink-0 items-center gap-2">
            <Link
              to={{ area: "flow", flow: flow.id, node: node.id }}
              className="block w-[168px] rounded-xl border border-border bg-background p-2 hover:border-primary/50"
            >
              <span className="mb-1.5 block font-mono text-[9.5px] tracking-[0.08em] text-muted-foreground uppercase">
                {padNumber(node.step)} · {t(`kind.${stepKind(flow, node)}`)}
              </span>
              {node.kind === "prototype" ? (
                <span className="block overflow-hidden rounded-md border border-border">
                  <Preview
                    target={{ slug: node.proto, state: node.state, theme, role: node.role ?? null }}
                    title={t("preview.of", { title: `${node.title} · ${node.stateLabel}` })}
                    width={720}
                    height={420}
                    order={index}
                  />
                </span>
              ) : (
                <span className="grid aspect-[720/420] place-items-center truncate rounded-md border border-dashed border-border px-2 font-mono text-[10px] text-muted-foreground">
                  {node.url ?? node.label}
                </span>
              )}
              <span className="mt-1.5 block truncate text-xs font-medium">
                {node.kind === "prototype" ? node.stateLabel : node.label}
              </span>
            </Link>
            {index < steps.length - 1 && <span className="h-px w-3 bg-[var(--shell-edge)]" />}
          </li>
        ))}
      </ol>
    </article>
  );
}

/** A CLI command with a copy button (empty states, drafts). */
export function CommandLine({ command }: { command: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background py-1 pr-1 pl-3 font-mono text-xs">
      <span className="text-primary" aria-hidden="true">
        $
      </span>
      <code className="min-w-0 flex-1 truncate">{command}</code>
      <button
        type="button"
        aria-label={copied ? t("common.copied") : t("common.copyCommand")}
        onClick={() => void navigator.clipboard?.writeText(command).then(() => setCopied(true))}
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground",
          copied && "text-[var(--tone-end)]"
        )}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}

/** Section heading of a grid page: mono eyebrow and a count. */
export function SectionTitle({ title, count }: { title: string; count?: number }) {
  return (
    <div className="mb-3 flex items-baseline gap-2">
      <h2 className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
        {title}
      </h2>
      {count !== undefined && (
        <span className="font-mono text-[10px] text-muted-foreground">{padNumber(count)}</span>
      )}
    </div>
  );
}
