import { useLayoutEffect, useRef, useState } from "react";

/** The content box of an element, kept current with a ResizeObserver. */
export function useBox<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setBox({ width: entry.contentRect.width, height: entry.contentRect.height });
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
    const watch = (key: "visible" | "near", rootMargin: string) => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          const value = entry?.isIntersecting ?? false;
          setVisibility(current =>
            current[key] === value ? current : { ...current, [key]: value }
          );
        },
        { rootMargin }
      );
      observer.observe(element);
      return observer;
    };
    const observers = [watch("visible", "0px"), watch("near", "100% 100% 100% 100%")];
    return () => {
      for (const observer of observers) observer.disconnect();
    };
  }, [ref]);
  return visibility;
}
