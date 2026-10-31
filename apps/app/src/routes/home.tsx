import { Button } from "@proto/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@proto/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

import { api, result } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

export function Home() {
  const router = useRouter();
  const me = useQuery({ queryKey: ["me"], queryFn: async () => result(await api.GET("/v1/me")) });

  async function signOut() {
    await authClient.signOut();
    await router.navigate({ to: "/login" });
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-md items-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{me.data ? `Hello, ${me.data.name}` : "Loading…"}</CardTitle>
          <CardDescription>{me.data?.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={signOut}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
