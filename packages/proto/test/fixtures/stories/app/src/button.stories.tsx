import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";
import { http, HttpResponse } from "msw";
import { useEffect, useState } from "react";
function Button({ label = "Button" }: { label?: string }) {
  const [clicked, setClicked] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.effect = "ready";
  }, []);
  return <button onClick={() => setClicked(true)}>{clicked ? "Clicked" : label}</button>;
}
const meta = {
  title: "UI/Button",
  component: Button,
  args: { onClick: fn() },
  parameters: { layout: "centered" },
  decorators: [
    Story => (
      <div data-preview="inner">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
export const Primary: Story = {
  play: async ({ canvas, userEvent, step }) => {
    await step("click", async () => {
      await userEvent.click(canvas.getByRole("button"));
      await expect(canvas.getByRole("button")).toHaveTextContent("Clicked");
    });
    await expect(document.documentElement.dataset.effect).toBe("ready");
  },
};
export const Plain: Story = {};
export const Network: Story = {
  parameters: {
    msw: { handlers: [http.get("/fixture", () => HttpResponse.json({ label: "Mock response" }))] },
  },
  loaders: [async () => ({ response: await fetch("/fixture").then(response => response.json()) })],
  render: (_, { loaded }) => <Button label={loaded.response.label} />,
};
export const Fail: Story = {
  play: async () => {
    throw new Error("play failure");
  },
};
export const LoadFail: Story = {
  loaders: [
    () => {
      throw new Error("loader failure");
    },
  ],
};
export const RenderFail: Story = {
  render: () => {
    throw new Error("render failure");
  },
};
export const Hang: Story = {
  play: async () => {
    await new Promise(() => {});
  },
};
export const Late: Story = {
  play: async () => {
    await new Promise(resolve => {
      Object.assign(window, { finishLateStory: resolve });
    });
  },
};
export const LoadHang: Story = {
  loaders: [
    async () => {
      await new Promise(() => {});
      return {};
    },
  ],
};
