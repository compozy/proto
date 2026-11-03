import type { Preview } from "@storybook/react-vite";
export const decorators: Preview["decorators"] = [
  Story => (
    <article data-root="ui">
      <Story />
    </article>
  ),
];
