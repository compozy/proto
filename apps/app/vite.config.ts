import { productionBoundary } from "@proto/gallery/vite";
import { defineConfig, mergeConfig } from "vite";

import presentationConfig from "./vite.presentation.ts";

export default mergeConfig(
  presentationConfig,
  // Prototypes, fixtures, stories, drafts, flows and preview tooling never reach the SPA bundle.
  defineConfig({ plugins: [productionBoundary()] })
);
