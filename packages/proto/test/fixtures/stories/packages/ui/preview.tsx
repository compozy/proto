import { useEffect, type ReactNode } from "react";
import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react-vite";
function Decoration({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.dataset.uiReact = "ready";
  }, []);
  return <article data-root="ui">{children}</article>;
}
export const decorators: Preview["decorators"] = [
  withThemeByClassName({ themes: { light: "", dark: "dark" }, defaultTheme: "light" }),
  Story => (
    <Decoration>
      <Story />
    </Decoration>
  ),
];
