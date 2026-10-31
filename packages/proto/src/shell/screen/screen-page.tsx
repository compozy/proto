/**
 * S6 Screen view and S7 Compare: one prototype state in a fitted frame (or light and dark side by
 * side) with the state picker, viewport, role and theme, all mirrored in the URL (US-013).
 */
import { useState } from "react";

import type { RegistryPrototype } from "../../model/registry";
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
import { ScreenFrame, type FrameGeometry } from "../frames/screen-frame";
import type { FrameContext } from "../frames/use-render-frame";
import { useT } from "../lib/i18n";
import { go, navigate } from "../lib/navigation";
import {
  occurrences,
  orderedPrototypes,
  padNumber,
  resolveRole,
  resolveState,
  roleOptions,
  specTitle,
} from "../lib/registry-model";
import { useShellData, useRegistry } from "../lib/shell-data";
import { useShortcuts } from "../lib/shortcuts";
import { screenView, type ThemeChoice, type View } from "../lib/view";
import { Button } from "../ui/button";
import { Check, Copy, ExternalLink, Moon, Sun, Users } from "../ui/icons";
import { NativeSelect, NativeSelectOption } from "../ui/native-select";
import { useStateAnnotation } from "../review/review-ui";
import { StatePicker } from "./state-picker";
import { ViewportControl } from "./viewport-control";

type ScreenView = Extract<View, { area: "screen" }>;

export function ScreenPage({
  view,
  theme,
  themeChoice,
  prototype,
}: {
  view: ScreenView;
  theme: "light" | "dark";
  themeChoice: ThemeChoice;
  prototype: RegistryPrototype;
}) {
  const t = useT();
  const registry = useRegistry();
  const { bootstrap } = useShellData();
  const slots = useSlots();
  const inspector = useInspector();
  const [tab, setTab] = useState(view.comment ? "comments" : "state");
  const annotate = useStateAnnotation(prototype.slug);
  // A comment focused from the URL (inbox, search, a CLI link) opens the Comments tab.
  const [seenComment, setSeenComment] = useState(view.comment);
  if (view.comment !== seenComment) {
    setSeenComment(view.comment);
    if (view.comment) setTab("comments");
  }
  const [fitWidth, setFitWidth] = useState(0);
  const { state, unknown } = resolveState(prototype, view.state);
  const role = resolveRole(registry, prototype, view.role);
  const slugs = new Set(registry.prototypes.map(item => item.slug));
  const flowsHere = occurrences(registry, prototype.slug, state.id);
  const flowsAny = flowsHere.length ? flowsHere : occurrences(registry, prototype.slug);
  const target: Extract<ReviewTarget, { kind: "prototype" }> = {
    kind: "prototype",
    key: prototype.slug,
    slug: prototype.slug,
    state: state.id,
  };

  const frameSlot = slots.screenFrame?.(target);
  const update = (patch: Partial<ScreenView>, options?: { replace?: boolean }) =>
    go({ ...view, ...patch }, options);
  const ordered = orderedPrototypes(registry);
  const position = ordered.findIndex(item => item.slug === prototype.slug);
  const stepState = (delta: number) => {
    const next = prototype.states[prototype.states.indexOf(state) + delta];
    if (next) update({ state: next.id });
  };
  const stepPrototype = (delta: number) => {
    const next = ordered[position + delta];
    if (next) go(screenView(next.slug, null, { width: view.width, compare: view.compare }));
  };
  const openView = (next: ViewTab) => {
    if (next === "flow") {
      const first = flowsAny[0];
      if (first) go({ area: "flow", flow: first.flow.id, node: first.node.id });
    } else update({ compare: next === "compare" });
  };
  useShortcuts({
    j: () => stepState(-1),
    k: () => stepState(1),
    "[": () => stepPrototype(-1),
    "]": () => stepPrototype(1),
    "1": () => openView("flow"),
    "2": () => openView("screen"),
    "3": () => openView("compare"),
  });

  // The prototype moved itself (`setParam(s)`, `protoHref`): follow it without reloading.
  const onContext = (context: FrameContext) => {
    const next = screenView(context.slug, context.state, {
      width: context.w ? context.w : view.width,
      role: context.role,
      compare: view.compare,
    });
    navigate({ view: next, theme: context.theme ?? themeChoice }, { replace: true });
  };

  const specLabel = prototype.spec
    ? specTitle(registry, prototype.spec)
    : t(prototype.kind === "draft" ? "overview.drafts" : "overview.unsorted");
  const meta = [prototype.surface, prototype.route, bootstrap.commit?.slice(0, 7)]
    .filter(Boolean)
    .join(" · ");
  const roles = roleOptions(registry, prototype);
  const frameTarget = { slug: prototype.slug, state: state.id, theme, role };

  const tabs: InspectorTab[] = [
    {
      id: "state",
      label: t("inspector.state"),
      content: (
        <StatePanel
          prototype={prototype}
          stateLabel={state.label}
          role={role ? (registry.roles[role] ?? role) : null}
          specLabel={specLabel}
          flows={flowsHere}
        />
      ),
    },
    ...(slots.inspectorTabs?.(target) ?? []),
    { id: "source", label: t("inspector.source"), content: <SourcePanel prototype={prototype} /> },
  ];

  return (
    <>
      <ShellSubHeader
        title={prototype.title}
        status={slots.reviewStatus?.(target)}
        meta={meta}
        view={view.compare ? "compare" : "screen"}
        views={flowsAny.length ? ["flow", "screen", "compare"] : ["screen", "compare"]}
        onView={openView}
        theme={theme}
        panel={inspector.panel}
        menu={slots.reviewMenu?.(target)}
      />
      <div className="relative flex min-h-0 flex-1">
        <section
          aria-label={t("screen.canvas")}
          className="shell-dots flex min-h-0 min-w-0 flex-1 flex-col"
        >
          <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 pt-4">
            <StatePicker
              prototype={prototype}
              state={state}
              unknown={unknown}
              annotate={annotate}
              onState={id => update({ state: id })}
            />
            {roles.length > 0 && (
              <RolePicker value={role} options={roles} onRole={value => update({ role: value })} />
            )}
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {!view.compare && (
                <ViewportControl
                  width={view.width}
                  fitWidth={fitWidth}
                  onWidth={width => update({ width }, { replace: true })}
                />
              )}
              {slots.canvasTools?.(target)}
            </div>
          </div>
          {view.compare ? (
            <CompareCanvas
              prototype={prototype}
              target={frameTarget}
              width={view.width === "fit" ? 1440 : view.width}
              slugs={slugs}
            />
          ) : (
            <ScreenFrame
              target={frameTarget}
              width={view.width}
              title={`${prototype.title} · ${state.label}`}
              slugs={slugs}
              onContext={onContext}
              onMessage={frameSlot?.onMessage}
              overlay={frameSlot?.overlay}
              onGeometry={(geometry: FrameGeometry) => setFitWidth(geometry.width)}
              className="flex-1 px-6 pt-5 pb-2"
              caption={geometry => (
                <p className="shrink-0 pt-2 text-center font-mono text-[11px] text-muted-foreground tabular-nums">
                  {prototype.slug} · {state.id} · {geometry.width} × {geometry.height}
                </p>
              )}
            />
          )}
        </section>
        <Inspector
          title={state.label}
          eyebrow={t("screen.eyebrow", {
            number: padNumber(prototype.states.indexOf(state) + 1),
            slug: prototype.slug,
          })}
          tabs={tabs}
          tab={tab}
          onTab={setTab}
          open={inspector.open}
          onClose={inspector.close}
        />
      </div>
    </>
  );
}

function RolePicker({
  value,
  options,
  onRole,
}: {
  value: string | null;
  options: { value: string | null; label: string }[];
  onRole: (role: string | null) => void;
}) {
  const t = useT();
  return (
    <label className="flex h-9 items-center gap-1.5 rounded-xl border border-border bg-[var(--shell-panel)] py-1 pr-1 pl-2.5">
      <Users className="size-3.5 text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">{t("screen.role")}</span>
      <NativeSelect
        size="sm"
        value={value ?? ""}
        onChange={event => onRole(event.target.value || null)}
        className="border-0 bg-transparent text-[13px] shadow-none"
      >
        {options.map(option => (
          <NativeSelectOption key={option.value ?? ""} value={option.value ?? ""}>
            {option.value === null ? t("screen.defaultRole") : option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </label>
  );
}

/** S7: the same state in light and dark, side by side at one width. */
function CompareCanvas({
  prototype,
  target,
  width,
  slugs,
}: {
  prototype: RegistryPrototype;
  target: { slug: string; state: string; role: string | null };
  width: number;
  slugs: ReadonlySet<string>;
}) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-2 gap-4 px-6 py-5 xl:gap-8">
      {(["light", "dark"] as const).map(theme => (
        <div key={theme} className="flex min-h-0 min-w-0 flex-col gap-2.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {theme === "light" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            <span className="font-mono tracking-[0.08em] uppercase">{theme}</span>
            <span className="ml-auto font-mono tabular-nums">{width}</span>
          </div>
          <ScreenFrame
            target={{ ...target, theme }}
            width={width}
            title={`${prototype.title} · ${theme}`}
            slugs={slugs}
            className="flex-1"
          />
        </div>
      ))}
    </div>
  );
}

/** State tab: where the state sits in the product and the flows that show it. */
function StatePanel({
  prototype,
  stateLabel,
  role,
  specLabel,
  flows,
}: {
  prototype: RegistryPrototype;
  stateLabel: string;
  role: string | null;
  specLabel: string;
  flows: ReturnType<typeof occurrences>;
}) {
  const t = useT();
  return (
    <>
      <Section title={t("inspector.screen")}>
        <Facts>
          <Fact label={t("facts.prototype")} mono>
            {[prototype.slug, prototype.surface].filter(Boolean).join(" · ")}
          </Fact>
          <Fact label={t("facts.spec")}>{specLabel}</Fact>
          <Fact label={t("facts.route")} mono>
            {prototype.route ?? "—"}
          </Fact>
          <Fact label={t("facts.state")}>
            <StateDot>{stateLabel}</StateDot>
          </Fact>
          {role && <Fact label={t("facts.role")}>{role}</Fact>}
        </Facts>
      </Section>
      <Section title={t("inspector.inFlows")} aside={String(flows.length)}>
        {flows.length ? (
          <ul className="flex flex-col gap-1.5">
            {flows.map(({ flow, node }) => (
              <li key={`${flow.id}-${node.id}`}>
                <Link
                  to={{ area: "flow", flow: flow.id, node: node.id }}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-[13px] hover:border-primary/50"
                >
                  <span className="truncate font-medium">{flow.title}</span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground uppercase">
                    {t("flow.step", { step: node.step })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">{t("inspector.noFlows")}</p>
        )}
      </Section>
    </>
  );
}

/** Source tab: the prototype file and the bare render URL (what screenshots capture). */
function SourcePanel({ prototype }: { prototype: RegistryPrototype }) {
  const t = useT();
  const { renderUrl } = useShellData();
  const [copied, setCopied] = useState(false);
  const bare = `${renderUrl.replace(/\/?$/, "/")}${prototype.slug}?chrome=0`;
  return (
    <>
      <Section title={t("inspector.file")}>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background py-1 pr-1 pl-3">
          <code className="min-w-0 flex-1 truncate font-mono text-xs">{prototype.file}</code>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={copied ? t("common.copied") : t("health.copyPath")}
            onClick={() =>
              void navigator.clipboard?.writeText(prototype.file).then(() => setCopied(true))
            }
          >
            {copied ? <Check /> : <Copy />}
          </Button>
        </div>
      </Section>
      {!renderUrl.endsWith(".html") && (
        <Section title={t("inspector.bare")}>
          <a
            href={bare}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs hover:border-primary/50"
          >
            <span className="min-w-0 flex-1 truncate">{bare}</span>
            <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
          </a>
        </Section>
      )}
    </>
  );
}
