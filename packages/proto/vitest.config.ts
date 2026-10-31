import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

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
        plugins: [react()],
        test: {
          name: "browser",
          include: ["test/browser/**/*.test.{ts,tsx}"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
