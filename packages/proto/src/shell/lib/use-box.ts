import { useLayoutEffect, useRef, useState } from "react";

/** The content box of an element, kept current with a ResizeObserver. */
export function useBox<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        const { width, height } = entry.contentRect;
        setBox(current =>
          current.width === width && current.height === height ? current : { width, height }
        );
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, box] as const;
}

/** Whether an element is on screen (`visible`) or within one screen of it (`near`). */
export function useVisibility(ref: { current: Element | null }) {
  const [visibility, setVisibility] = useState({ visible: false, near: false });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    /** Publish visibility changes only when the observer reports a different intersection state. */
    const update = (key: "visible" | "near", entry?: IntersectionObserverEntry) => {
      const value = entry?.isIntersecting ?? false;
      setVisibility(current => (current[key] === value ? current : { ...current, [key]: value }));
    };
    const visible = new IntersectionObserver(([entry]) => update("visible", entry));
    const near = new IntersectionObserver(([entry]) => update("near", entry), {
      rootMargin: "100% 100% 100% 100%",
    });
    visible.observe(element);
    near.observe(element);
    return () => {
      visible.disconnect();
      near.disconnect();
    };
  }, [ref]);
  return visibility;
}
