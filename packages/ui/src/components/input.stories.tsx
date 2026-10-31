import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";

import { Input } from "./input.tsx";
import { Label } from "./label.tsx";

const meta = {
  title: "UI/Forms/Input",
  component: Input,
  args: { id: "name", placeholder: "Your name", autoComplete: "name" },
  render: args => (
    <div className="grid max-w-sm gap-2">
      <Label htmlFor={args.id}>Name</Label>
      <Input {...args} />
    </div>
  ),
} satisfies Meta<typeof Input>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  // Invariant: a labeled field accepts text through its native input. Owner: Input browser stories.
  play: async ({ canvas }) => {
    const field = canvas.getByRole("textbox", { name: "Name" });
    await userEvent.type(field, "Ada Lovelace");
    await expect(field).toHaveValue("Ada Lovelace");
  },
};
export const Filled: Story = { args: { defaultValue: "Ada Lovelace" } };
export const Invalid: Story = {
  args: { "aria-invalid": true, "aria-describedby": "name-error" },
  render: args => (
    <div className="grid max-w-sm gap-2">
      <Label htmlFor={args.id}>Name</Label>
      <Input {...args} />
      <p id="name-error" className="text-sm text-destructive">
        Enter your name.
      </p>
    </div>
  ),
};
export const Disabled: Story = { args: { disabled: true } };
