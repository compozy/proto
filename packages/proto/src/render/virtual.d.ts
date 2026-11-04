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

declare module "virtual:proto/story-config" {
  export const config: { shellOrigin: string; root: string; themeGlobal: string; staticBuild: boolean };
}
declare module "virtual:proto/story-runtime" {
  export type ComposedStory = ReturnType<typeof import("@storybook/react-vite").composeStory>;
  export { composeStories, setProjectAnnotations } from "@storybook/react-vite";
  export { addons, mockChannel } from "storybook/preview-api";
  export { within, userEvent } from "storybook/test";
}
declare module "virtual:proto/story-preview" {
  export function loadPreview(): Promise<import("@storybook/react-vite").Preview>;
}
declare module "virtual:proto/story-entries" {
  export const entries: (import("../model/registry.ts").RegistryStoryFile & {
    load(): Promise<{ default: import("@storybook/react-vite").Meta } & Record<string, unknown>>;
  })[];
}
