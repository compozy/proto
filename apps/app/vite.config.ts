import { proto } from "@compozy/proto/vite";
import { defineConfig, mergeConfig } from "vite";

import presentationConfig from "./vite.shared.ts";

export default mergeConfig(
  presentationConfig,
  // Prototypes, fixtures, stories, drafts, flows and preview tooling never reach the SPA bundle.
  defineConfig({ plugins: [proto()] })
);
