import { TooltipProvider } from "@proto/ui/components/tooltip";
import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react-vite";

import { Canvas } from "../proto.canvas";
import "../src/styles.css";

const preview: Preview = {
  tags: ["autodocs"],
  decorators: [
    withThemeByClassName({
      themes: { light: "", dark: "dark" },
      defaultTheme: "light",
      parentSelector: "html",
    }),
    Story => (
      <TooltipProvider>
        <Canvas>
          <Story />
        </Canvas>
      </TooltipProvider>
    ),
  ],
  parameters: {
    layout: "padded",
    controls: { expanded: true, matchers: { color: /(background|color)$/i, date: /Date$/i } },
    backgrounds: { disable: true },
    a11y: { test: "error" },
    options: { storySort: { order: ["UI", "App"] } },
  },
};

export default preview;
