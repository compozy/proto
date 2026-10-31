import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

import * as renderCommands from "./test/browser/render/harness/commands.ts";

const harness = (file: string) =>
  new URL(`./test/browser/render/harness/${file}`, import.meta.url).pathname;

/**
 * Node project: registry, model, store, router, server, CLI, MCP and migrate. Browser project
 * (Chromium): shell, render host and the shell ⇄ render protocol. `*.it.test.ts` suites need
 * `TEST_DATABASE_URL` (a Postgres per suite) and skip themselves without it.
 */
export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: ["test/node/**/*.test.ts"],
        },
      },
      {
        // Tailwind compiles the shell theme the shell suites import (layout drives frame sizing).
        plugins: [react(), tailwindcss()],
        // The protocol suite embeds the render host from `localhost` in the page on 127.0.0.1:
        // two real origins on one server.
        server: { host: "127.0.0.1" },
        // The render host page loads its own dependencies; optimizing them up front avoids a
        // mid-test reload of the frame on a cold cache.
        optimizeDeps: { include: ["react", "react/jsx-dev-runtime", "react-dom/client", "zod"] },
        resolve: {
          alias: {
            "virtual:proto/render-config": harness("render-config.ts"),
            "virtual:proto/prototypes": harness("prototypes.tsx"),
            "virtual:proto/canvas": harness("canvas.tsx"),
          },
        },
        test: {
          name: "browser",
          include: ["test/browser/**/*.test.{ts,tsx}"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            commands: renderCommands,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
