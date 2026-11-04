import {
  Component,
  useEffect,
  useState,
  useLayoutEffect,
  type ErrorInfo,
  type ReactNode,
} from "react";
import type { Anchor, PickMode } from "../model/protocol.ts";
import type { Bridge } from "./bridge.ts";
import { watchAnchors } from "./anchors.ts";
import { useShellMessages } from "./use-shell-messages.ts";
import { Picker } from "./picker.tsx";
import { sourceRoots } from "../model/source.ts";
import { messageOf } from "./errors.ts";
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

/** Notify the host only after React has committed the story subtree. */
export function RenderCommit({
  children,
  onCommit,
}: {
  children: ReactNode;
  onCommit: () => void;
}) {
  useLayoutEffect(() => onCommit(), [onCommit]);
  return children;
}
