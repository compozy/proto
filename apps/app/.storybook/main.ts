import { protoPresentation } from "@compozy/proto/vite";
import type { StorybookConfig } from "@storybook/react-vite";
import { fileURLToPath } from "node:url";
import { mergeConfig } from "vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.tsx", "../../../packages/ui/src/**/*.stories.tsx"],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-themes",
    "@storybook/addon-vitest",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {
      strictMode: true,
      builder: {
        viteConfigPath: fileURLToPath(new URL("../vite.shared.ts", import.meta.url)),
      },
    },
  },
  core: { disableTelemetry: true },
  features: { experimentalDocgenServer: true },
  viteFinal: config =>
    mergeConfig(config, {
      plugins: protoPresentation(),
      build: {
        // Storybook's prebuilt runtime and axe are indivisible vendor modules; this catalog
        // budget does not change the application's 500 kB limit.
        chunkSizeWarningLimit: 900,
        rolldownOptions: {
          output: {
            codeSplitting: {
              groups: [
                { name: "react", test: /node_modules\/(?:react|react-dom|scheduler)\// },
                { name: "navigation", test: /node_modules\/@tanstack\// },
                { name: "base-ui", test: /node_modules\/@base-ui\// },
                {
                  name: "storybook",
                  test: /node_modules\/(?:storybook|@storybook)\//,
                  maxSize: 250_000,
                },
              ],
            },
          },
        },
      },
    }),
};

export default config;
