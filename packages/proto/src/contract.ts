import type { ReactNode } from "react";

export type PrototypeState = { id: string; label: string };

/**
 * Literal metadata of a prototype, read statically by discovery (never executed). `spec` names a
 * group from the app's `gallery.config.ts` (prototypes without one are listed under "Unsorted"),
 * `roles` a subset of its roles, and `standalone` opts a component prototype out of the app frame
 * (`PrototypeFrame` in `preview/canvas.tsx`), for full-page screens such as sign-in.
 */
export type PrototypeMeta = {
  title: string;
  spec?: string;
  surface?: string;
  route?: string;
  blocks?: readonly string[];
  states: readonly [PrototypeState, ...PrototypeState[]];
  roles?: readonly [string, ...string[]];
  standalone?: boolean;
};

export type PrototypeProps = { state: string; role: string | null };

/**
 * Props of the `PrototypeFrame` an app exports from `preview/canvas.tsx`: it wraps component
 * prototypes (not drafts, not `standalone` ones) in the app's production chrome for `route`.
 */
export type PrototypeFrameProps = {
  route: string;
  role: string | null;
  state: string;
  children: ReactNode;
};

/** Providers around every rendered state (`proto.canvas.tsx` export `Canvas`). */
export type CanvasProps = { children: ReactNode; theme: "light" | "dark"; role: string | null };

/** Production chrome around component prototypes (`proto.canvas.tsx` export `Frame`). */
export type FrameProps = PrototypeFrameProps;

export function definePrototype<const Meta extends PrototypeMeta>(meta: Meta): Meta {
  return meta;
}

export { protoHref, setParam, setParams, useSearch } from "./render/url-state.ts";
