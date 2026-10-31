import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    passWithNoTests: true,
    // Integration suites create and drop a database in their hooks.
    hookTimeout: 30_000,
  },
});
