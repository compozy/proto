import tailwindcss from "@tailwindcss/vite";
import react, { type Options } from "@vitejs/plugin-react";
import { createRequire } from "node:module";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const app = fileURLToPath(new URL(".", import.meta.url));
const require = createRequire(import.meta.url);
const uiRequire = createRequire(require.resolve("@proto/ui/package.json"));
const baseUiExports = Object.keys(uiRequire("@base-ui/react/package.json").exports);

/**
 * React Compiler options shared with the production config. It compiles app views, prototypes and canvas;
 * the vendored `@proto/ui` memoizes by hand and is consumed like a library.
 */
export const reactOptions: Options = {
  compiler: {
    panicThreshold: "all_errors",
    sources: [`${app}src/`, `${app}proto.canvas.tsx`],
  },
};

/** Production, prototypes (`proto`) and stories share styles, aliases and compiler behavior. */
export default defineConfig({
  // One .env.local at the repo root feeds every app; only VITE_* reaches the browser.
  envDir: fileURLToPath(new URL("../..", import.meta.url)),
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // Base UI belongs to the UI workspace, not this app. Resolve its public entry points there
  // so browser tests do not re-optimize and reload midway through a cold run.
  optimizeDeps: {
    include: baseUiExports
      .filter(path => /^\.\/[a-z-]+$/.test(path) && path !== "./types" && path !== "./esm")
      .map(path => `@proto/ui > @base-ui/react${path.slice(1)}`),
  },
  plugins: [tailwindcss(), react(reactOptions)],
});
