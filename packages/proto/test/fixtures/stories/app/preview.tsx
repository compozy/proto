import { useEffect, type ReactNode } from "react";
import { initialize, mswLoader } from "msw-storybook-addon";
import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react-vite";
initialize({ onUnhandledRequest: "error" });
const increment = (key: string) => {
  const html = document.documentElement;
  html.dataset[key] = String(Number(html.dataset[key] ?? 0) + 1);
};
export const beforeAll = () => {
  increment("beforeAll");
};
export const loaders: Preview["loaders"] = [
  mswLoader,
  () => {
    increment("projectLoader");
    return { projectLoaded: true };
  },
];
function PreviewDecoration({ children, theme }: { children: ReactNode; theme: unknown }) {
  useEffect(() => {
    increment("previewDecorator");
  }, []);
  return (
    <section data-preview="outer" data-theme-global={String(theme)}>
      {children}
    </section>
  );
}
export const decorators: Preview["decorators"] = [
  withThemeByClassName({ themes: { light: "", dark: "dark" }, defaultTheme: "light" }),
  (Story, context) => (
    <PreviewDecoration theme={context.globals.theme}>
      <Story />
    </PreviewDecoration>
  ),
];
