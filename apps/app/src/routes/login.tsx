import { useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { LoginForm, type LoginMode, type LoginValues } from "@/components/login-form";
import { authClient } from "@/lib/auth-client";

export function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>("sign-in");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit({ name, email, password }: LoginValues) {
    setPending(true);
    setError(null);
    const result =
      mode === "sign-in"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name });
    setPending(false);
    if (result.error) return setError(result.error.message ?? "Something went wrong");
    await router.navigate({ to: "/" });
  }

  return (
    <LoginForm
      mode={mode}
      error={error}
      pending={pending}
      onModeChange={setMode}
      onSubmit={values => void submit(values)}
    />
  );
}
