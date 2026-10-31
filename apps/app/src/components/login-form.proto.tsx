import { definePrototype, setParam, type PrototypeProps } from "@proto/gallery";

import { LoginForm } from "./login-form";

export const meta = definePrototype({
  title: "Sign in",
  spec: "auth",
  surface: "A1",
  route: "/login",
  standalone: true,
  states: [
    { id: "sign-in", label: "Sign in" },
    { id: "sign-up", label: "Create account" },
    { id: "error", label: "Wrong password" },
    { id: "pending", label: "Submitting" },
  ],
});

export default function Prototype({ state }: PrototypeProps) {
  return (
    <LoginForm
      mode={state === "sign-up" ? "sign-up" : "sign-in"}
      error={state === "error" ? "Invalid email or password" : null}
      pending={state === "pending"}
      onModeChange={mode => setParam("state", mode)}
      onSubmit={() => setParam("state", "pending")}
    />
  );
}
