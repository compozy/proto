import { useRouter, useSearch } from "@tanstack/react-router";
import { useState } from "react";

import { LoginForm, type LoginMode, type LoginValues } from "@/components/login-form";
import { reviewReturn } from "@/lib/auth-return";
import { authClient } from "@/lib/auth-client";

export function Login() {
  const router = useRouter();
  const { returnTo } = useSearch({ from: "/login" });
  const [mode, setMode] = useState<LoginMode>("sign-in");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  /** Submit the selected auth action, preserve failures for retry and always release pending state. */
  async function submit({ name, email, password }: LoginValues) {
    setPending(true);
    setError(null);
    try {
      const result =
        mode === "sign-in"
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({ email, password, name });
      if (result.error) {
        setError(result.error.message ?? "Something went wrong");
      } else {
        const href = reviewReturn(returnTo);
        if (href) window.location.assign(href);
        else await router.navigate({ to: "/" });
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Something went wrong");
    }
    setPending(false);
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
