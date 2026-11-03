/**
 * The render host: one prototype state per document on the render origin. It resolves the slug
 * (path `/__proto/render/<slug>` or static `?slug=`), the state (unknown or absent → the first),
 * theme, role and chrome from the URL; renders `Canvas` → `Frame` (component prototypes that are
 * not `standalone`; never drafts) → the prototype inside an error boundary; and speaks the render
 * side of the protocol: `ready`, `error`, `context`, picking, anchors and `scroll:to`.
 */
import { useEffect, useEffectEvent, useRef, useState, type ComponentType } from "react";

import type { CanvasProps, FrameProps } from "../contract.ts";
import type { Anchor, ElementTarget, PickMode } from "../model/protocol.ts";
import type { PrototypeModule, RenderConfig, RenderPrototype } from "../model/render-host.ts";
import { sourceRoots } from "../model/source.ts";
import { watchAnchors } from "./anchors.ts";
import { createBridge, type Bridge } from "./bridge.ts";
import {
  RenderBoundary,
  RenderError,
  useShellMessages,
  limit,
  messageOf,
  type BoundaryProps,
} from "./shared.tsx";
import { Picker } from "./picker.tsx";
import { ThemeProvider, useTheme } from "./theme.tsx";
import { PrototypeToolbar } from "./toolbar.tsx";
import { resolveSlug, useSearch } from "./url-state.ts";

export type RenderHostProps = {
  config: RenderConfig;
  prototypes: readonly RenderPrototype[];
  Canvas: ComponentType<CanvasProps>;
  Frame: ComponentType<FrameProps> | null;
};

/** The requested state when the prototype declares it, else its first state. */
function resolveState(requested: string | null, states: RenderPrototype["states"]) {
  return states.find(option => option.id === requested)?.id ?? states[0].id;
}

/**
 * The requested role when the prototype supports it, else its first declared role; a prototype
 * without declared roles renders any requested role (the shell offers the configured ones).
 */
function resolveRole(requested: string | null, declared: readonly string[]) {
  if (declared.length === 0) return requested || null;
  return declared.find(role => role === requested) ?? declared[0] ?? null;
}

/**
 * Whether the render grant expired (remote): the host's own document answers 401. The shell
 * reacts to `auth:expired` with a new render ticket and reloads the frame.
 */
async function grantExpired(url: string) {
  try {
    const response = await fetch(url, { method: "HEAD", credentials: "include" });
    return response.status === 401;
  } catch {
    return false;
  }
}

/** Posts `ready` once the prototype state committed (an effect of the prototype's sibling). */
function ReportReady({ onReady }: { onReady: () => void }) {
  const ready = useEffectEvent(onReady);
  useEffect(() => ready(), []);
  return null;
}

type Loaded = {
  slug: string;
  component: PrototypeModule["default"] | null;
  error: unknown;
};

/** Load the selected prototype and ignore results from an entry that has already been replaced. */
function useModule(entry: RenderPrototype | undefined, onFailure: (error: unknown) => void) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const fail = useEffectEvent(onFailure);
  useEffect(() => {
    if (!entry) return;
    let live = true;
    entry.load().then(
      module => live && setLoaded({ slug: entry.slug, component: module.default, error: null }),
      (error: unknown) => {
        if (!live) return;
        setLoaded({ slug: entry.slug, component: null, error });
        fail(error);
      }
    );
    return () => {
      live = false;
    };
  }, [entry]);
  return loaded?.slug === entry?.slug ? loaded : null;
}

/** The loaded prototype owns the error boundary; a replacement component resets a failed render. */
function PrototypeContent({
  entry,
  loaded,
  slug,
  state,
  role,
  theme,
  Canvas,
  Frame,
  bridge,
  reportError,
}: {
  entry: RenderPrototype | undefined;
  loaded: Loaded | null;
  slug: string | null;
  state: string;
  role: string | null;
  theme: "light" | "dark";
  Canvas: RenderHostProps["Canvas"];
  Frame: RenderHostProps["Frame"];
  bridge: Bridge;
  reportError: BoundaryProps["onError"];
}) {
  if (!entry) return <RenderError message={`Unknown prototype "${slug ?? ""}"`} />;
  if (loaded?.error) return <RenderError message={messageOf(loaded.error)} />;
  if (loaded?.component) {
    const Prototype = loaded.component;
    const framed = entry.kind === "component" && !entry.standalone && Frame !== null;
    const content = (
      <>
        <Prototype state={state} role={role} />
        <ReportReady
          onReady={() => {
            // Standalone capture has no parent bridge; expose the same committed readiness locally.
            document.documentElement.dataset.protoReady = `${entry.slug}:${state}`;
            bridge.post({ type: "ready", slug: entry.slug, state });
          }}
        />
      </>
    );
    return (
      <RenderBoundary
        key={`${entry.slug}:${state}:${role ?? ""}`}
        component={loaded.component}
        onError={reportError}
      >
        <Canvas theme={theme} role={role}>
          {framed ? (
            <Frame route={entry.route ?? "/"} role={role} state={state}>
              {content}
            </Frame>
          ) : (
            content
          )}
        </Canvas>
      </RenderBoundary>
    );
  }

  return null;
}

/** Coordinate URL context, prototype rendering and trusted shell messages for one render document. */
function Host({ config, prototypes, Canvas, Frame, bridge }: RenderHostProps & { bridge: Bridge }) {
  const search = useSearch();
  const { theme } = useTheme();
  const params = new URLSearchParams(search);
  const slug = resolveSlug(window.location, config.form);
  const entry = prototypes.find(prototype => prototype.slug === slug);
  const [pick, setPick] = useState<PickMode | null>(null);
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const roots = config.sourceRoots ?? sourceRoots();

  const reportError = (error: unknown, componentStack: string | null) => {
    bridge.post({
      type: "error",
      message: limit(messageOf(error), 4000),
      componentStack: componentStack === null ? null : limit(componentStack, 20000),
    });
  };

  const loaded = useModule(entry, error => {
    reportError(error, null);
    if (config.mode === "remote") {
      void grantExpired(window.location.href).then(expired => {
        if (expired) bridge.post({ type: "auth:expired" });
      });
    }
  });

  useShellMessages(bridge, { pick: setPick, anchors: setAnchors });

  const state = entry ? resolveState(params.get("state"), entry.states) : "";
  const role = entry ? resolveRole(params.get("role"), entry.roles) : null;

  const unknown = useEffectEvent(() => {
    reportError(new Error(`Unknown prototype "${slug ?? ""}"`), null);
  });
  useEffect(() => {
    if (!entry) unknown();
  }, [entry]);

  useEffect(() => {
    if (anchors.length === 0) return;
    return watchAnchors(window, anchors, rects => bridge.post({ type: "anchors", rects }));
  }, [anchors, bridge]);

  const postContext = useEffectEvent(() => {
    const url = `${window.location.pathname}${window.location.search}`;
    bridge.post({ type: "context", state, theme, role, url });
  });
  const seen = useRef<string | null>(null);
  useEffect(() => {
    const previous = seen.current;
    seen.current = search;
    if (previous !== null && previous !== search) postContext();
  }, [search]);

  useEffect(() => {
    if (entry) document.title = entry.title;
  }, [entry]);

  const onPicked = (target: ElementTarget) => {
    setPick(null);
    bridge.post({ type: "pick:result", target });
  };
  const onPickCancel = () => {
    setPick(null);
    bridge.post({ type: "pick:cancel" });
  };

  const galleryHref =
    entry && config.mode === "dev"
      ? `${config.shellOrigin}/?${new URLSearchParams({ p: entry.slug, state })}`
      : null;

  return (
    <>
      <PrototypeContent
        entry={entry}
        loaded={loaded}
        slug={slug}
        state={state}
        role={role}
        theme={theme}
        Canvas={Canvas}
        Frame={Frame}
        bridge={bridge}
        reportError={reportError}
      />
      {entry && params.get("chrome") !== "0" ? (
        <PrototypeToolbar slug={entry.slug} meta={entry} state={state} galleryHref={galleryHref} />
      ) : null}
      {pick ? (
        <Picker key={pick} mode={pick} roots={roots} onResult={onPicked} onCancel={onPickCancel} />
      ) : null}
    </>
  );
}

export function RenderHost(props: RenderHostProps) {
  const [bridge] = useState(() =>
    createBridge({
      self: window,
      shellOrigin: props.config.shellOrigin,
      frame: new URLSearchParams(window.location.search).get("frame"),
    })
  );
  return (
    <ThemeProvider>
      <Host {...props} bridge={bridge} />
    </ThemeProvider>
  );
}
