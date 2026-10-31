/**
 * The render host: one prototype state per document on the render origin. It resolves the slug
 * (path `/__proto/render/<slug>` or static `?slug=`), the state (unknown or absent → the first),
 * theme, role and chrome from the URL; renders `Canvas` → `Frame` (component prototypes that are
 * not `standalone`; never drafts) → the prototype inside an error boundary; and speaks the render
 * side of the protocol: `ready`, `error`, `context`, picking, anchors and `scroll:to`.
 */
import {
  Component,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from "react";

import type { CanvasProps, FrameProps } from "../contract.ts";
import type { Anchor, ElementTarget, PickMode, ShellMessage } from "../model/protocol.ts";
import type { PrototypeModule, RenderConfig, RenderPrototype } from "../model/render-host.ts";
import { renderPathPrefix } from "../model/render-host.ts";
import { sourceRoots } from "../model/source.ts";
import { watchAnchors } from "./anchors.ts";
import { createBridge, type Bridge } from "./bridge.ts";
import { queryElement } from "./dom.ts";
import { Picker } from "./picker.tsx";
import { ThemeProvider, useTheme } from "./theme.tsx";
import { PrototypeToolbar } from "./toolbar.tsx";
import { useSearch } from "./url-state.ts";

export type RenderHostProps = {
  config: RenderConfig;
  prototypes: readonly RenderPrototype[];
  Canvas: ComponentType<CanvasProps>;
  Frame: ComponentType<FrameProps> | null;
};

type Place = { pathname: string; search: string };

/** The slug a render URL names: `…/__proto/render/<slug>` (path form) or `?slug=` (query form). */
export function resolveSlug(place: Place, form: RenderConfig["form"]) {
  if (form === "query") return new URLSearchParams(place.search).get("slug");
  const at = place.pathname.lastIndexOf(renderPathPrefix);
  if (at < 0) return null;
  const rest = place.pathname.slice(at + renderPathPrefix.length).replace(/\/+$/, "");
  if (!rest || rest.includes("/")) return null;
  try {
    return decodeURIComponent(rest);
  } catch {
    return null;
  }
}

/** The requested state when the prototype declares it, else its first state. */
export function resolveState(requested: string | null, states: RenderPrototype["states"]) {
  return states.find(option => option.id === requested)?.id ?? states[0].id;
}

/**
 * The requested role when the prototype supports it, else its first declared role; a prototype
 * without declared roles renders any requested role (the shell offers the configured ones).
 */
export function resolveRole(requested: string | null, declared: readonly string[]) {
  if (declared.length === 0) return requested || null;
  return declared.find(role => role === requested) ?? declared[0] ?? null;
}

/**
 * Whether the render grant expired (remote): the host's own document answers 401. The shell
 * reacts to `auth:expired` with a new render ticket and reloads the frame.
 */
export async function grantExpired(url: string) {
  try {
    const response = await fetch(url, { method: "HEAD", credentials: "include" });
    return response.status === 401;
  } catch {
    return false;
  }
}

const limit = (text: string, max: number) => (text.length > max ? text.slice(0, max) : text);

function messageOf(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

type BoundaryProps = {
  children: ReactNode;
  onError: (error: unknown, componentStack: string | null) => void;
};

/** A canvas, frame or prototype that throws shows the error and reports it to the shell. */
class RenderBoundary extends Component<BoundaryProps, { error: unknown }> {
  state: { error: unknown } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error ?? new Error("Unknown render error") };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    this.props.onError(error, info.componentStack ?? null);
  }

  render() {
    if (this.state.error) return <RenderError message={messageOf(this.state.error)} />;
    return this.props.children;
  }
}

function RenderError({ message }: { message: string }) {
  return (
    <pre
      role="alert"
      data-testid="proto-render-error"
      style={{
        margin: 0,
        padding: 24,
        font: "12px/1.5 ui-monospace, monospace",
        whiteSpace: "pre-wrap",
      }}
    >
      {message}
    </pre>
  );
}

/** Posts `ready` once the prototype state committed (an effect of the prototype's sibling). */
function ReportReady({ onReady }: { onReady: () => void }) {
  const ready = useEffectEvent(onReady);
  useEffect(() => ready(), []);
  return null;
}

type Loaded = { slug: string; module: PrototypeModule | null; error: unknown };

function useModule(entry: RenderPrototype | undefined, onFailure: (error: unknown) => void) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const fail = useEffectEvent(onFailure);
  useEffect(() => {
    if (!entry) return;
    let live = true;
    entry.load().then(
      module => live && setLoaded({ slug: entry.slug, module, error: null }),
      (error: unknown) => {
        if (!live) return;
        setLoaded({ slug: entry.slug, module: null, error });
        fail(error);
      }
    );
    return () => {
      live = false;
    };
  }, [entry]);
  return loaded?.slug === entry?.slug ? loaded : null;
}

/** The shell side drives picking, anchors and scrolling; everything else stays local. */
function useShellMessages(
  bridge: Bridge,
  handlers: {
    pick: (mode: PickMode | null) => void;
    anchors: (anchors: Anchor[]) => void;
  }
) {
  const onMessage = useEffectEvent((message: ShellMessage) => {
    if (message.type === "pick:start") handlers.pick(message.mode);
    else if (message.type === "pick:cancel") handlers.pick(null);
    else if (message.type === "anchors:watch") handlers.anchors(message.anchors);
    else if (message.type === "scroll:to") {
      queryElement(document, message.selector)?.scrollIntoView({ block: "center" });
    }
  });
  useEffect(() => bridge.listen(onMessage), [bridge]);
}

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

  let body: ReactNode = null;
  if (!entry) body = <RenderError message={`Unknown prototype "${slug ?? ""}"`} />;
  else if (loaded?.error) body = <RenderError message={messageOf(loaded.error)} />;
  else if (loaded?.module) {
    const Prototype = loaded.module.default;
    const framed = entry.kind === "component" && !entry.standalone && Frame !== null;
    const content = (
      <>
        <Prototype state={state} role={role} />
        <ReportReady onReady={() => bridge.post({ type: "ready", slug: entry.slug, state })} />
      </>
    );
    body = (
      <RenderBoundary key={`${entry.slug}:${state}:${role ?? ""}`} onError={reportError}>
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

  const galleryHref =
    entry && config.mode === "dev"
      ? `${config.shellOrigin}/?${new URLSearchParams({ p: entry.slug, state })}`
      : null;

  return (
    <>
      {body}
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
