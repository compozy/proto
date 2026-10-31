import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent } from "storybook/test";

import { LoginForm } from "./login-form";

const meta = {
  title: "App/Login form",
  component: LoginForm,
  parameters: { layout: "fullscreen" },
  args: { mode: "sign-in", error: null, pending: false, onModeChange: fn(), onSubmit: fn() },
} satisfies Meta<typeof LoginForm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SignIn: Story = {
  // Invariant: submitting hands the typed credentials to the container once. Owner: LoginForm stories.
  play: async ({ canvas, args }) => {
    await userEvent.type(canvas.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(canvas.getByLabelText("Password"), "correct-horse");
    await userEvent.click(canvas.getByRole("button", { name: "Sign in" }));
    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ email: "ada@example.com", password: "correct-horse" })
    );
  },
};
export const SignUp: Story = { args: { mode: "sign-up" } };
export const Failed: Story = { args: { error: "Invalid email or password" } };
export const Pending: Story = { args: { pending: true } };
