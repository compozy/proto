/**
 * The virtual modules the Vite plugin in render mode generates for the render host
 * (`src/model/render-host.ts` holds the types). Only `src/render` imports them.
 */

declare module "virtual:proto/render-config" {
  export const renderConfig: import("../model/render-host.ts").RenderConfig;
}

declare module "virtual:proto/prototypes" {
  export const prototypes: readonly import("../model/render-host.ts").RenderPrototype[];
}

declare module "virtual:proto/canvas" {
  export const Canvas: import("../model/render-host.ts").CanvasModule["Canvas"];
  export const Frame: import("../model/render-host.ts").CanvasModule["Frame"];
}
