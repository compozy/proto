declare module "virtual:gallery-prototypes" {
  export const prototypes: ReadonlyArray<
    import("./node/discovery").PrototypeEntry & {
      load: () => Promise<import("./shell/registry").PrototypeModule>;
    }
  >;
  export const problems: readonly import("./node/discovery").Problem[];
  export const flows: readonly import("./flow").FlowEntry[];
  export const flowProblems: readonly import("./flow").FlowProblem[];
  export const flowWarnings: readonly import("./flow").CoverageWarning[];
}

declare module "virtual:gallery-app" {
  import type { ComponentType, ReactNode } from "react";
  /** The app's `preview/canvas.tsx`: providers around every canvas, and its production chrome. */
  export const PresentationCanvas: ComponentType<{ children: ReactNode }>;
  export const PrototypeFrame: ComponentType<import("./contract").PrototypeFrameProps>;
  export const config: import("./config").ResolvedGalleryConfig;
}
