import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent } from "storybook/test";

import { ArrowRightIcon } from "../lib/icons.ts";
import { Button } from "./button.tsx";

const meta = {
  title: "UI/Actions/Button",
  component: Button,
  args: { children: "Save changes", onClick: fn() },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  // Invariant: keyboard activation invokes the action once. Owner: Button browser stories.
  play: async ({ canvas, args }) => {
    const button = canvas.getByRole("button", { name: "Save changes" });
    button.focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};
export const Disabled: Story = { args: { disabled: true } };
export const Outline: Story = { args: { variant: "outline" } };
export const Destructive: Story = { args: { variant: "destructive", children: "Remove access" } };
export const LinkComposition: Story = {
  args: {
    nativeButton: false,
    render: <a href="#next" />,
    children: (
      <>
        Continue <ArrowRightIcon />
      </>
    ),
  },
};
