import {
  Component,
  useEffect,
  useEffectEvent,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import type { Anchor, PickMode, ShellMessage } from "../model/protocol.ts";
import type { Bridge } from "./bridge.ts";
import { watchAnchors } from "./anchors.ts";
import { queryElement } from "./dom.ts";
import { Picker } from "./picker.tsx";
import { sourceRoots } from "../model/source.ts";
export const limit = (text: string, max: number) => (text.length > max ? text.slice(0, max) : text);

export function messageOf(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

export type BoundaryProps = {
  children: ReactNode;
  component: unknown;
  onError: (error: unknown, componentStack: string | null) => void;
};

/** A canvas, frame or prototype that throws shows the error and reports it to the shell. */
export class RenderBoundary extends Component<
  BoundaryProps,
  { error: unknown; component: unknown }
> {
  state: { error: unknown; component: unknown } = {
    error: null,
    component: this.props.component,
  };

  /** Clear a failed render when the component changes without remounting a healthy Canvas subtree. */
  static getDerivedStateFromProps(props: BoundaryProps, state: RenderBoundary["state"]) {
    return props.component !== state.component ? { error: null, component: props.component } : null;
  }

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

export function RenderError({ message }: { message: string }) {
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

/** The shell side drives picking, anchors and scrolling; everything else stays local. */
export function useShellMessages(
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
  useEffect(() => {
    const stop = bridge.listen(onMessage);
    return () => stop();
  }, [bridge]);
}

/** Picker overlays have their own root, outside the story canvas. */
export function StoryPicker({ bridge }: { bridge: Bridge }) {
  const [pick, setPick] = useState<PickMode | null>(null);
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  useShellMessages(bridge, { pick: setPick, anchors: setAnchors });
  useEffect(() => {
    if (!anchors.length) return;
    return watchAnchors(window, anchors, rects => bridge.post({ type: "anchors", rects }));
  }, [anchors, bridge]);
  return pick ? (
    <Picker
      key={pick}
      mode={pick}
      roots={sourceRoots()}
      onResult={target => {
        setPick(null);
        bridge.post({ type: "pick:result", target: { ...target, source: null } });
      }}
      onCancel={() => {
        setPick(null);
        bridge.post({ type: "pick:cancel" });
      }}
    />
  ) : null;
}
