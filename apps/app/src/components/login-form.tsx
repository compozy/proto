import { Button } from "@proto/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@proto/ui/components/card";
import { Input } from "@proto/ui/components/input";
import { Label } from "@proto/ui/components/label";

export type LoginMode = "sign-in" | "sign-up";
export type LoginValues = { name: string; email: string; password: string };

/** Sign-in and sign-up form. The route owns the auth calls; this view renders their state. */
export function LoginForm({
  mode,
  error,
  pending,
  onModeChange,
  onSubmit,
}: {
  mode: LoginMode;
  error: string | null;
  pending: boolean;
  onModeChange: (mode: LoginMode) => void;
  onSubmit: (values: LoginValues) => void;
}) {
  return (
    <main className="mx-auto flex min-h-svh max-w-sm items-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{mode === "sign-in" ? "Sign in" : "Create account"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={event => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              onSubmit({
                name: String(form.get("name")),
                email: String(form.get("email")),
                password: String(form.get("password")),
              });
            }}
            className="flex flex-col gap-4"
          >
            {mode === "sign-up" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" minLength={8} required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={pending}>
              {mode === "sign-in" ? "Sign in" : "Create account"}
            </Button>
            <Button
              type="button"
              variant="link"
              onClick={() => onModeChange(mode === "sign-in" ? "sign-up" : "sign-in")}
            >
              {mode === "sign-in" ? "No account? Create one" : "Have an account? Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
