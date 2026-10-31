/**
 * The prebuilt shell (ADR-002): bootstrap → registry → the area the URL names. It imports only
 * `src/model` and its own `ui/`, and talks to prototypes only through the render protocol.
 */
import { useEffect, useState, type ReactNode } from "react";

import type { Registry } from "../../model/registry";
import { FlowPage } from "../flow/flow-page";
import { LocaleProvider, useT } from "../lib/i18n";
import { go, navigate, useLocation } from "../lib/navigation";
import { specTitle } from "../lib/registry-model";
import { registryItems } from "../lib/search";
import { loadBootstrap, ShellDataProvider, useShellData, type ShellEnv } from "../lib/shell-data";
import { useShortcuts } from "../lib/shortcuts";
import { nextTheme, useDocumentTheme, useResolvedTheme } from "../lib/theme";
import type { View } from "../lib/view";
import { Drafts, FlowsIndex, Overview, ScreensIndex } from "../pages/overview";
import { SpecPage } from "../pages/spec-page";
import { ScreenPage } from "../screen/screen-page";
import { Button } from "../ui/button";
import { RotateCcw, TriangleAlert } from "../ui/icons";
import { Skeleton } from "../ui/skeleton";
import { Shell, ShellSubHeader, ShellTopBar, type Crumb } from "./chrome";
import { Link } from "./link";
import { actionItems, SearchPalette } from "./search-palette";
import { ShortcutsSheet } from "./shortcuts-sheet";
import { SessionExpiredBanner, SignInPage } from "../review/auth/auth";
import { reviewKeys, ReviewProvider, useReviewData } from "../review/data";
import { Inbox } from "../review/inbox/inbox";
import { KeysStatus, readOnlySlots, reviewSlots, useCommentSearchItems } from "../review/review-ui";
import { Settings } from "../review/settings/settings";
import {
  CommentModeProvider,
  commentModeSlots,
  Composer,
  useCommentMode,
} from "../review/comment-mode";
import {
  CommentFocusProvider,
  ShellSlotsProvider,
  type ReviewTarget,
  type ShellSlots,
} from "./slots";

type Boot =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; env: ShellEnv };

export function Root() {
  const [boot, setBoot] = useState<Boot>({ status: "loading" });
  useEffect(() => {
    loadBootstrap().then(
      env => setBoot({ status: "ready", env }),
      (error: unknown) => setBoot({ status: "error", message: String(error) })
    );
  }, []);
  if (boot.status === "loading") return <BootSkeleton />;
  if (boot.status === "error")
    return <Fatal message={boot.message} onRetry={() => window.location.reload()} />;
  return (
    <LocaleProvider locale={boot.env.bootstrap.locale}>
      <ShellDataProvider env={boot.env}>
        <App />
      </ShellDataProvider>
    </LocaleProvider>
  );
}

function BootSkeleton() {
  return (
    <div className="flex h-svh w-full" aria-busy="true">
      <div className="w-14 border-r border-border bg-[var(--shell-rail)]" />
      <div className="flex flex-1 flex-col">
        <div className="h-12 border-b border-border" />
        <div className="shell-dots flex-1" />
      </div>
    </div>
  );
}

/** Before the bootstrap loads there is no locale: this card is English only. */
function Fatal({
  message,
  onRetry,
  title = "The gallery could not start",
}: {
  message: string;
  onRetry: () => void;
  title?: string;
}) {
  return (
    <div className="shell-dots grid h-svh w-full place-items-center p-6">
      <div
        role="alert"
        className="w-full max-w-[520px] rounded-2xl border border-destructive/40 bg-[var(--shell-panel)] p-6"
      >
        <div className="flex items-center gap-2 text-[15px] font-semibold text-destructive">
          <TriangleAlert className="size-4" />
          {title}
        </div>
        <p className="mt-3 font-mono text-xs break-words text-muted-foreground">{message}</p>
        <Button className="mt-5" onClick={onRetry}>
          <RotateCcw data-icon="inline-start" />
          Retry
        </Button>
      </div>
    </div>
  );
}

function App() {
  const t = useT();
  const { bootstrap, registry, reload } = useShellData();
  const { view, theme: choice } = useLocation();
  const theme = useResolvedTheme(choice);
  useDocumentTheme(theme, bootstrap.locale);
  useEffect(() => {
    document.title = bootstrap.title;
  }, [bootstrap.title]);
  // A remote gallery without a session has nothing it may read yet: sign in first (S18).
  if (bootstrap.mode === "remote" && !bootstrap.principal) return <SignInPage />;
  if (registry.status === "loading") {
    return (
      <Shell view={view}>
        <div className="h-12 border-b border-border" />
        <div
          className="shell-dots grid flex-1 place-items-center"
          role="status"
          aria-label={t("frame.loading")}
        >
          <Skeleton className="h-40 w-80 rounded-2xl" />
        </div>
      </Shell>
    );
  }
  if (registry.status === "error") {
    return <Fatal title={t("app.registryFailed")} message={registry.message} onRetry={reload} />;
  }
  return (
    <ReviewProvider keys={reviewKeys(registry.registry)}>
      <Slots>
        <Browse view={view} choice={choice} theme={theme} registry={registry.registry} />
      </Slots>
    </ReviewProvider>
  );
}

/** Review slots (threads, approval) and comment mode (tools, picking, pins, composer). */
function Slots({ children }: { children: ReactNode }) {
  const t = useT();
  const review = useReviewData();
  const { bootstrap } = useShellData();
  const [slots] = useState<ShellSlots>(() =>
    review
      ? { ...reviewSlots(t), ...commentModeSlots, composer: Composer }
      : bootstrap.mode === "read-only"
        ? readOnlySlots(t)
        : {}
  );
  if (!review) return <ShellSlotsProvider value={slots}>{children}</ShellSlotsProvider>;
  return (
    <CommentModeProvider>
      <FocusBridge>
        <ShellSlotsProvider value={slots}>{children}</ShellSlotsProvider>
      </FocusBridge>
    </CommentModeProvider>
  );
}

/** Threads and pins share one focused comment: comment mode's. */
function FocusBridge({ children }: { children: ReactNode }) {
  const { focused, focusComment } = useCommentMode();
  return <CommentFocusProvider value={{ focused, focusComment }}>{children}</CommentFocusProvider>;
}

type Page = { crumbs: Crumb[]; target: ReviewTarget | null; share: boolean; body: ReactNode };

function Browse({
  view,
  choice,
  theme,
  registry,
}: {
  view: View;
  choice: ReturnType<typeof useLocation>["theme"];
  theme: "light" | "dark";
  registry: Registry;
}) {
  const t = useT();
  const [overlay, setOverlay] = useState<"search" | "shortcuts" | null>(null);
  const toggleTheme = () => navigate({ view, theme: nextTheme(theme) }, { replace: true });
  useShortcuts(
    {
      "mod+k": () => setOverlay("search"),
      "/": () => setOverlay("search"),
      "?": () => setOverlay("shortcuts"),
      t: toggleTheme,
    },
    overlay === null
  );
  const review = useReviewData() !== null;
  const page = pageFor(view, registry, theme, choice, t, review);
  const searchable = [
    ...registryItems(registry),
    ...useCommentSearchItems(),
    ...actionItems(t, { compare: view.area === "screen" && !view.compare }),
  ];
  const onAction = (action: string) => {
    if (action === "theme") toggleTheme();
    else if (action === "health") go({ area: "settings", section: "health" });
    else if (action === "shortcuts") setOverlay("shortcuts");
    else if (action === "compare" && view.area === "screen") go({ ...view, compare: true });
  };
  return (
    <Shell view={view}>
      <ShellTopBar
        crumbs={page.crumbs}
        problems={registry.problems.length}
        target={page.target}
        share={page.share}
        onSearch={() => setOverlay("search")}
      />
      <SessionExpiredBanner />
      <main id="shell-main" tabIndex={-1} className="flex min-h-0 flex-1 flex-col outline-none">
        {page.body}
      </main>
      {overlay === "search" && (
        <SearchPalette items={searchable} onAction={onAction} onClose={() => setOverlay(null)} />
      )}
      {overlay === "shortcuts" && <ShortcutsSheet onClose={() => setOverlay(null)} />}
    </Shell>
  );
}

function pageFor(
  view: View,
  registry: Registry,
  theme: "light" | "dark",
  choice: ReturnType<typeof useLocation>["theme"],
  t: ReturnType<typeof useT>,
  review: boolean
): Page {
  const area = (title: string, body: ReactNode, subtitle?: ReactNode): Page => ({
    crumbs: [{ label: title }],
    target: null,
    share: false,
    body: (
      <>
        {subtitle}
        {body}
      </>
    ),
  });
  switch (view.area) {
    case "spec": {
      const known =
        registry.specs?.[view.spec] !== undefined ||
        registry.prototypes.some(item => item.spec === view.spec);
      if (!known) return area(view.spec, <NotFound kind="spec" id={view.spec} />);
      const title = specTitle(registry, view.spec);
      const prototypes = registry.prototypes.filter(item => item.spec === view.spec);
      const flows = registry.flows.filter(flow => flow.spec === view.spec);
      return area(
        title,
        <SpecPage spec={view.spec} theme={theme} />,
        <ShellSubHeader
          title={title}
          theme={theme}
          status={
            <KeysStatus
              keys={[...prototypes.map(item => item.slug), ...flows.map(flow => `flow-${flow.id}`)]}
            />
          }
          meta={[
            view.spec,
            t("count.flows", { count: flows.length }),
            t("count.screens", { count: prototypes.length }),
            t("count.states", {
              count: prototypes.reduce((sum, item) => sum + item.states.length, 0),
            }),
          ].join(" · ")}
        />
      );
    }
    case "flow": {
      const flow = registry.flows.find(item => item.id === view.flow);
      if (!flow) return area(view.flow, <NotFound kind="flow" id={view.flow} />);
      return {
        crumbs: [
          ...(flow.spec
            ? [
                {
                  label: specTitle(registry, flow.spec),
                  to: { area: "spec", spec: flow.spec } as View,
                },
              ]
            : []),
          { label: t("rail.flows"), to: { area: "flows" } },
          { label: flow.title },
        ],
        target: { kind: "flow", key: `flow-${flow.id}`, flow: flow.id, node: view.node },
        share: true,
        body: (
          <FlowPage
            key={flow.id}
            flow={flow}
            node={view.node}
            comment={view.comment ?? null}
            theme={theme}
          />
        ),
      };
    }
    case "screen": {
      const prototype = registry.prototypes.find(item => item.slug === view.slug);
      if (!prototype) return area(view.slug, <NotFound kind="prototype" id={view.slug} />);
      const group = prototype.spec
        ? {
            label: specTitle(registry, prototype.spec),
            to: { area: "spec", spec: prototype.spec } as View,
          }
        : prototype.kind === "draft"
          ? { label: t("rail.drafts"), to: { area: "drafts" } as View }
          : { label: t("rail.screens"), to: { area: "screens" } as View };
      const state = prototype.states.find(item => item.id === view.state) ?? prototype.states[0];
      return {
        crumbs: [group, { label: prototype.title }],
        target: { kind: "prototype", key: prototype.slug, slug: prototype.slug, state: state.id },
        share: true,
        body: (
          <ScreenPage
            key={prototype.slug}
            view={view}
            theme={theme}
            themeChoice={choice}
            prototype={prototype}
          />
        ),
      };
    }
    case "flows":
      return area(t("rail.flows"), <FlowsIndex />);
    case "screens":
      return area(t("rail.screens"), <ScreensIndex theme={theme} />);
    case "drafts":
      return area(t("rail.drafts"), <Drafts theme={theme} />);
    case "settings":
      return area(t("rail.settings"), <Settings section={view.section} />);
    case "comments":
      if (review) return area(t("rail.comments"), <Inbox filter={view.filter} theme={theme} />);
      return area(t("rail.overview"), <Overview theme={theme} />);
    default:
      return area(t("rail.overview"), <Overview theme={theme} />);
  }
}

function NotFound({ kind, id }: { kind: "spec" | "flow" | "prototype"; id: string }) {
  const t = useT();
  return (
    <div className="shell-dots grid min-h-0 flex-1 place-items-center p-6">
      <div className="w-full max-w-[440px] rounded-2xl border border-border bg-[var(--shell-panel)] p-6 text-center">
        <h1 className="text-[15px] font-semibold">{t(`notFound.${kind}`, { id })}</h1>
        <Link
          to={{ area: "overview" }}
          className="mt-4 inline-flex h-8 items-center rounded-full border border-border px-3 text-[13px] hover:bg-muted"
        >
          {t("notFound.back")}
        </Link>
      </div>
    </div>
  );
}
