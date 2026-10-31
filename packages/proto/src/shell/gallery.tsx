/**
 * Prototype gallery at `/`: a collapsible sidebar (flows and prototypes by spec) and a main area
 * that renders the selected level: the specs index, a spec overview (`?spec=`), a flow canvas
 * (`?flow=`) or a prototype in one state, with review comments on either. The whole view lives
 * in the URL (`view.ts`); keyboard shortcuts in `use-shortcuts.ts`.
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useRef, useState, type CSSProperties, type RefObject } from "react";
import { flushSync } from "react-dom";

import { SidebarInset, SidebarProvider, useSidebar } from "@proto/ui/components/sidebar";
import { Toaster } from "@proto/ui/components/toast";

import { flowKey } from "../flow";
import { useCommentCounts, useComments } from "./comments/api";
import type { CommentCounts, ReviewComment } from "./comments/model";
import type { FrameInfo } from "./frame";
import { FlowToolbar } from "./flow-toolbar";
import { IndexOverview, SpecOverview } from "./overview";
import { useRegistry } from "./registry";
import { groupOf, specOfFlow, type Entry, type Registry } from "./registry-model";
import { galleryQueryClient } from "./query";
import { step, useGallerySelection } from "./use-selection";
import { useShortcuts, type ShortcutAction } from "./use-shortcuts";
import { GallerySidebar } from "./sidebar";
import { matches } from "./sidebar-model";
import { PrototypeView } from "./prototype-view";
import { GallerySidebarTrigger } from "./topbar";
import { select, updateView } from "./view";
import { useRootDark } from "../render/theme";

const FlowView = lazy(() =>
  import("./flows/flow-view").then(module => ({ default: module.FlowView }))
);

/** The sidebar reopens as the reviewer left it (`SidebarProvider` writes this cookie). */
const sidebarOpen = () => !document.cookie.split("; ").includes("sidebar_state=false");

const flowSideKey = "gallery-flow-side";

export function Gallery() {
  return (
    <QueryClientProvider client={galleryQueryClient}>
      <Toaster>
        <SidebarProvider
          defaultOpen={sidebarOpen()}
          className="h-dvh min-h-0 overflow-hidden bg-sidebar text-foreground"
          style={{ "--sidebar-width": "300px" } as CSSProperties}
        >
          <GalleryContent />
        </SidebarProvider>
      </Toaster>
    </QueryClientProvider>
  );
}

type Selection = ReturnType<typeof useGallerySelection>;

/** Gallery-wide UI state that is not part of the URL. */
function useGalleryState() {
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [frame, setFrame] = useState<FrameInfo | null>(null);
  const [flowSide, setFlowSide] = useState(() => localStorage.getItem(flowSideKey) !== "false");
  const showFlowSide = (open: boolean) => {
    localStorage.setItem(flowSideKey, String(open));
    setFlowSide(open);
  };
  return {
    query,
    setQuery,
    picking,
    setPicking,
    helpOpen,
    setHelpOpen,
    frame,
    setFrame,
    flowSide,
    showFlowSide,
  };
}

type GalleryState = ReturnType<typeof useGalleryState>;

/**
 * J/K step through prototypes (journeys on a flow), [/] through states (steps), T switches the
 * theme, C comments, / searches, ? shows help and Cmd/Ctrl+B toggles the sidebar.
 */
function useGalleryShortcuts(
  selection: Selection,
  ui: GalleryState,
  navigable: Entry[],
  searchRef: RefObject<HTMLInputElement | null>
) {
  const dark = useRootDark();
  const sidebar = useSidebar();
  const { view, flow, current, states, state } = selection;

  const stepState = (direction: 1 | -1) => {
    const ids = states.map(option => option.id);
    const next = step(ids, state, direction);
    if (next) updateView({ state: next, comment: null });
  };

  const comment = () => {
    if (flow) {
      ui.showFlowSide(true);
      updateView({ panel: !view.panel, comment: null });
    } else if (current && !view.compare) ui.setPicking(!ui.picking);
  };

  const search = () => {
    // The search lives in the sidebar: open it first when it is collapsed.
    flushSync(() => {
      if (sidebar.isMobile) sidebar.setOpenMobile(true);
      else sidebar.setOpen(true);
    });
    searchRef.current?.focus({ preventScroll: true });
  };

  const actions: Record<ShortcutAction, () => void> = {
    next: () => (flow ? selection.stepFlow(1) : goTo(step(navigable, current ?? undefined, 1))),
    previous: () =>
      flow ? selection.stepFlow(-1) : goTo(step(navigable, current ?? undefined, -1)),
    "next-state": () => (flow ? selection.stepNode(1) : stepState(1)),
    "previous-state": () => (flow ? selection.stepNode(-1) : stepState(-1)),
    theme: () => updateView({ theme: dark ? "light" : "dark" }),
    comment,
    search,
    help: () => ui.setHelpOpen(!ui.helpOpen),
    sidebar: () => sidebar.toggleSidebar(),
  };
  useShortcuts(action => actions[action](), ui.frame?.doc.defaultView ?? null);
}

function goTo(entry: Entry | undefined) {
  if (entry) select({ kind: "prototype", slug: entry.slug });
}

function GalleryContent() {
  const registry = useRegistry();
  const searchRef = useRef<HTMLInputElement>(null);
  const ui = useGalleryState();
  const selection = useGallerySelection(registry);
  const { flow, current } = selection;
  const comments = useComments(flow ? flowKey(flow.id) : (current?.slug ?? null));
  const counts = useCommentCounts();
  const navigable = registry.entries.filter(entry => matches(entry, ui.query));
  useGalleryShortcuts(selection, ui, navigable, searchRef);

  return (
    <>
      <GallerySidebar
        registry={registry}
        current={current}
        flow={flow}
        active={selection.active}
        state={selection.state}
        level={selection.level}
        query={ui.query}
        onQuery={ui.setQuery}
        searchRef={searchRef}
        comments={comments}
        counts={counts}
      />
      <SidebarInset className="min-h-0 min-w-0 gap-3 bg-sidebar p-3">
        <MainArea
          registry={registry}
          selection={selection}
          ui={ui}
          comments={comments}
          counts={counts}
          navigable={navigable}
        />
      </SidebarInset>
    </>
  );
}

/** The level on screen: flow, missing flow, prototype, spec overview or the specs index. */
function MainArea({
  registry,
  selection,
  ui,
  comments,
  counts,
  navigable,
}: {
  registry: Registry;
  selection: Selection;
  ui: GalleryState;
  comments: ReviewComment[];
  counts: CommentCounts;
  navigable: Entry[];
}) {
  const dark = useRootDark();
  const { view, resolved, flow, missingFlow, current, spec } = selection;
  const help = { helpOpen: ui.helpOpen, onHelp: ui.setHelpOpen };

  const onInfo = (info: FrameInfo | null) => {
    ui.setFrame(info);
    // A link inside the prototype opened another one: follow it in the gallery.
    if (info && current && info.slug !== current.slug) {
      if (registry.entries.some(entry => entry.slug === info.slug)) {
        select({ kind: "prototype", slug: info.slug, state: info.state });
      }
    }
  };

  if (flow) {
    const node = resolved.kind === "flow" ? resolved.node : null;
    const side = ui.flowSide || view.panel;
    const onSide = (open: boolean) => {
      ui.showFlowSide(open);
      if (!open) updateView({ panel: false, comment: null });
    };
    return (
      <>
        <FlowToolbar
          flow={flow}
          node={node}
          owner={groupOf(registry, specOfFlow(registry, flow))}
          dark={dark}
          openComments={comments.filter(comment => comment.status === "open").length}
          panel={view.panel}
          side={side}
          onSide={onSide}
          {...help}
        />
        <Suspense
          fallback={
            <p role="status" className="p-6 text-sm">
              Loading the flow…
            </p>
          }
        >
          <FlowView
            flow={flow}
            node={node}
            registry={registry}
            theme={view.theme}
            comments={comments}
            panel={view.panel}
            comment={view.comment}
            side={side}
            onSide={onSide}
          />
        </Suspense>
      </>
    );
  }
  if (missingFlow) return <MissingFlow id={missingFlow} registry={registry} />;
  if (current) {
    return (
      <PrototypeView
        entry={current}
        registry={registry}
        group={groupOf(registry, selection.active)}
        view={view}
        state={selection.state}
        dark={dark}
        comments={comments}
        frame={ui.frame}
        onInfo={onInfo}
        picking={ui.picking}
        onPicking={ui.setPicking}
        onStep={direction => goTo(step(navigable, current, direction))}
        {...help}
      />
    );
  }
  const overview = { registry, counts, dark, ...help };
  const specGroup = spec ? groupOf(registry, spec) : undefined;
  return specGroup ? (
    <SpecOverview {...overview} group={specGroup} />
  ) : (
    <IndexOverview {...overview} />
  );
}

/** `?flow=` names no valid flow: say so (with its problems, if it is broken) and show no fallback. */
function MissingFlow({ id, registry }: { id: string; registry: Registry }) {
  const problems = registry.flowProblems.filter(problem => problem.flow === id);
  return (
    <>
      <header className="flex min-h-12 items-center">
        <GallerySidebarTrigger />
      </header>
      <section
        className="flex flex-1 flex-col items-center justify-center gap-3 rounded-[20px] bg-card p-6 text-center"
        role="status"
        data-testid="flow-missing"
      >
        <h1 className="text-[20px] tracking-[-0.02em]">Flow not found</h1>
        <p className="max-w-[46ch] text-[14px] text-muted-foreground">
          No valid flow is called <span className="font-mono text-foreground">{id}</span>. It may
          have been renamed, or its file has problems. Pick a spec or a journey from the list.
        </p>
        {problems.length > 0 ? (
          <ul className="flex max-w-xl flex-col gap-1 rounded-[14px] bg-muted p-3 text-left font-mono text-xs text-muted-foreground">
            {problems.map(problem => (
              <li key={`${problem.code}:${problem.node ?? ""}:${problem.message}`}>
                {problem.file}: {problem.message}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </>
  );
}
