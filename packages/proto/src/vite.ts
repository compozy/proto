// Vite plugins an app's own configs use: the presentation boundary for stories and prototypes
// (`vite.presentation.ts`) and the production boundary for the app build (`vite.config.ts`).
export { presentationGuard, type PresentationBoundary } from "./node/presentation-guard.ts";
export { productionBoundary } from "./node/production-boundary.ts";
export { proto, protoPresentation, renderPlugins } from "./vite/index.ts";
