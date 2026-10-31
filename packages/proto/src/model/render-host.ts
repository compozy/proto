/**
 * Contract between the Vite plugin in render mode (`src/vite`, which generates these virtual
 * modules inside the consumer's module graph) and the render host (`src/render`, the iframe
 * entry compiled by the consumer's Vite). Types only; the ambient declarations for the module
 * ids live in `src/render/virtual.d.ts`.
 */

import type { ComponentType } from "react";
import type { CanvasProps, FrameProps, PrototypeProps } from "../contract.ts";
import type { Bootstrap } from "./bootstrap.ts";
import type { RegistryPrototype } from "./registry.ts";

/** `virtual:proto/render-config` — injected by `proto dev`/`proto build`, never from the URL. */
export const renderConfigModule = "virtual:proto/render-config";
export type RenderConfig = {
  mode: Bootstrap["mode"];
  /** The only origin the render host accepts parent messages from. */
  shellOrigin: string;
  /** Render URL form: `path` (`/__proto/render/<slug>`) or `query` (static `?slug=`). */
  form: "path" | "query";
};

/** `virtual:proto/prototypes` — every discovered prototype with a lazy loader. */
export const prototypesModule = "virtual:proto/prototypes";
export type PrototypeModule = {
  default: ComponentType<PrototypeProps>;
};
export type RenderPrototype = Pick<
  RegistryPrototype,
  "slug" | "kind" | "title" | "route" | "standalone" | "states" | "roles"
> & { load: () => Promise<PrototypeModule> };

/**
 * `virtual:proto/canvas` — the consumer's `proto.canvas.tsx` (its own CSS imports load here, on
 * the render origin only). `Canvas` defaults to a passthrough when the file is missing (warning
 * `canvas_missing`); `Frame` is null when the file exports none.
 */
export const canvasModule = "virtual:proto/canvas";
export type CanvasModule = {
  Canvas: ComponentType<CanvasProps>;
  Frame: ComponentType<FrameProps> | null;
};

/** Path prefix the render origin serves the host under. */
export const renderPathPrefix = "/__proto/render/";
