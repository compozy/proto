import { useSearch } from "@compozy/proto";
import { cn } from "@proto/ui/lib/utils";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** The shell theme from `?theme=`; previews follow it unless their URL pins one. */
export function useShellTheme(): "light" | "dark" {
  return new URLSearchParams(useSearch()).get("theme") === "light" ? "light" : "dark";
}

function withTheme(src: string, theme: "light" | "dark") {
  return src.includes("theme=") ? src : `${src}&theme=${theme}`;
}

/**
 * A real prototype state, rendered by the gallery's standalone route in an inert iframe and
 * scaled by a fixed factor: for fixed-size surfaces such as flow cards.
 */
export function LivePreview({
  src,
  width = 1280,
  height = 800,
  scale,
  className,
  title,
}: {
  src: string;
  width?: number;
  height?: number;
  scale: number;
  className?: string;
  title: string;
}) {
  const theme = useShellTheme();
  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{ width: width * scale, height: height * scale }}
    >
      <Frame
        src={withTheme(src, theme)}
        title={title}
        width={width}
        height={height}
        scale={scale}
      />
    </div>
  );
}

function Frame({
  src,
  title,
  width,
  height,
  scale,
}: {
  src: string;
  title: string;
  width: number;
  height: number;
  scale: number;
}) {
  return (
    <iframe
      src={src}
      title={title}
      tabIndex={-1}
      loading="lazy"
      className="pointer-events-none absolute top-0 left-0 origin-top-left border-0 bg-background"
      style={{
        width,
        height,
        transform: `scale(${scale})`,
        visibility: scale > 0 ? "visible" : "hidden",
      }}
    />
  );
}

function useBox() {
  const ref = useRef<HTMLDivElement>(null);
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

/**
 * A live preview that scales to its container. `width` mode fills the container width and keeps
 * the viewport ratio; `contain` mode fits the whole viewport inside the container, centered, and
 * places `overlay` (comment pins) in the frame's coordinate box.
 */
export function FitPreview({
  src,
  title,
  width = 1280,
  height = 800,
  fit = "width",
  maxScale = 1,
  className,
  frameClassName,
  overlay,
}: {
  src: string;
  title: string;
  width?: number;
  height?: number;
  fit?: "width" | "contain";
  maxScale?: number;
  className?: string;
  frameClassName?: string;
  overlay?: ReactNode;
}) {
  const theme = useShellTheme();
  const [ref, box] = useBox();
  const scale = Math.min(
    maxScale,
    fit === "contain" ? Math.min(box.width / width, box.height / height) : box.width / width
  );
  const frame = (
    <div
      className={cn("relative overflow-hidden", frameClassName)}
      style={{ width: width * scale, height: height * scale }}
    >
      <Frame
        src={withTheme(src, theme)}
        title={title}
        width={width}
        height={height}
        scale={scale}
      />
      {scale > 0 && overlay}
    </div>
  );
  if (fit === "width") {
    return (
      <div
        ref={ref}
        className={cn("relative w-full", className)}
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        {frame}
      </div>
    );
  }
  return (
    <div ref={ref} className={cn("grid min-h-0 min-w-0 place-items-center", className)}>
      {frame}
    </div>
  );
}
