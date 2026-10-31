import { protoPresentation } from "@compozy/proto/vite";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";

import presentationConfig from "./vite.shared.ts";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          sequence: { groupOrder: 0 },
          include: ["tests/**/*.test.ts"],
          passWithNoTests: true,
        },
      },
      // Every story renders in Chromium, in light and dark, with its a11y checks and play functions.
      ...["light", "dark"].map(theme =>
        mergeConfig(
          presentationConfig,
          defineConfig({
            plugins: [
              ...protoPresentation(),
              storybookTest({
                configDir: fileURLToPath(new URL("./.storybook", import.meta.url)),
                initialGlobals: { theme },
              }),
            ],
            test: {
              name: `storybook-${theme}`,
              sequence: { groupOrder: 1 },
              browser: {
                enabled: true,
                headless: true,
                provider: playwright(),
                instances: [{ browser: "chromium" }],
              },
            },
          })
        )
      ),
    ],
  },
});
