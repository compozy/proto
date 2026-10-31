import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const shell = fileURLToPath(new URL("./src/shell/", import.meta.url));

/**
 * The prebuilt shell (ADR-002): its own React app, compiled CSS and vendored BnUI, built once
 * with the package into `dist/shell/`. Every URL is relative (`base: "./"`), so the shell serves
 * from `/`, a static host subpath or a remote `basePath` unchanged; it learns everything else
 * from `bootstrap.json` at runtime.
 */
export default defineConfig({
  root: shell,
  base: "./",
  publicDir: false,
  envPrefix: [],
  plugins: [tailwindcss(), react({ compiler: { panicThreshold: "all_errors", sources: [shell] } })],
  build: {
    outDir: fileURLToPath(new URL("./dist/shell/", import.meta.url)),
    emptyOutDir: true,
    assetsDir: "assets",
    sourcemap: false,
    reportCompressedSize: true,
    // One entry, no code splitting: the whole shell is one cached script (budget: slice 6).
    chunkSizeWarningLimit: 1200,
  },
});
