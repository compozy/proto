/**
 * One prototype in an iframe on its standalone URL (`frameSrc`). Changing `src` rewrites the
 * iframe location in place (no reload when only the query changes). The prototype canvas uses it
 * interactively; flow nodes wrap it inert in `flows/preview-frame.tsx`.
 */
import { useEffect, useEffectEvent, useRef, useState } from "react";

export type FrameInfo = { doc: Document; slug: string; state: string | null; shell: boolean };

type FrameProps = {
  src: string;
  title: string;
  width: number;
  height: number;
  scale: number;
  onInfo?: (info: FrameInfo | null) => void;
  /** The iframe element, for hosts that check which window a message came from. */
  onFrame?: (element: HTMLIFrameElement | null) => void;
  tabIndex?: number;
};

/** Whether the page renders an app shell with a sidebar (`PrototypeFrame`), i.e. honours `?role=`. */
const hasShell = (doc: Document) => Boolean(doc.querySelector('[data-slot="sidebar-wrapper"]'));

export function Frame(props: FrameProps) {
  const { src, title, width, height, scale, onInfo, onFrame, tabIndex } = props;
  const ref = useRef<HTMLIFrameElement>(null);
  const attach = (element: HTMLIFrameElement | null) => {
    ref.current = element;
    onFrame?.(element);
  };
  const [initialSrc] = useState(src);
  const [loadCount, setLoadCount] = useState(0);

  useEffect(() => {
    const view = ref.current?.contentWindow;
    if (!view) return;
    const target = new URL(src, window.location.href);
    try {
      if (view.location.pathname !== target.pathname) {
        view.location.replace(target.href);
      } else if (view.location.search !== target.search) {
        view.history.replaceState(null, "", target.href);
        view.dispatchEvent(new PopStateEvent("popstate"));
      }
    } catch {
      // Still on the initial about:blank document: load the target instead.
      view.location.replace(target.href);
    }
  }, [src]);

  const report = useEffectEvent((info: FrameInfo) => onInfo?.(info));

  useEffect(() => {
    const doc = ref.current?.contentDocument;
    if (!doc || loadCount === 0) return;
    const read = () => {
      const params = new URLSearchParams(doc.location.search);
      const current = doc.location.pathname.replace(/^\/+|\/+$/g, "");
      report({ doc, slug: current, state: params.get("state"), shell: hasShell(doc) });
    };
    read();
    // The shell mounts after the module loads; stop watching once it is known.
    const observer = new MutationObserver(() => {
      if (hasShell(doc)) {
        read();
        observer.disconnect();
      }
    });
    observer.observe(doc.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [loadCount]);

  return (
    <iframe
      ref={attach}
      src={initialSrc}
      tabIndex={tabIndex}
      title={title}
      onLoad={() => setLoadCount(count => count + 1)}
      className="block origin-top-left border-0 bg-background"
      style={{ width, height, transform: scale === 1 ? undefined : `scale(${scale})` }}
      data-testid="prototype-frame"
    />
  );
}
