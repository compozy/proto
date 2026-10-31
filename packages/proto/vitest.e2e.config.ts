import { defineConfig } from "vitest/config";

/**
 * Shell journeys against the real `proto dev` of `apps/app` driven by Playwright Chromium
 * (`bun run test:e2e:shell`; needs `dist/shell`, built first by the script). Not part of
 * `vitest run`: each journey boots the paired dev servers.
 */
export default defineConfig({
  test: {
    name: "e2e-shell",
    environment: "node",
    include: ["test/e2e/review/**/*.test.ts"],
    testTimeout: 90_000,
    hookTimeout: 90_000,
    fileParallelism: false,
  },
});
