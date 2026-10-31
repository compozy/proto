import { definePrototype, type PrototypeProps } from "@proto/gallery";
import { Badge } from "@proto/ui/components/badge";
import { Button } from "@proto/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@proto/ui/components/card";

export const meta = definePrototype({
  title: "Welcome home",
  surface: "D1",
  route: "/",
  states: [
    { id: "default", label: "First steps" },
    { id: "done", label: "All done" },
  ],
});

const steps = ["Invite your team", "Connect a data source", "Publish the first report"];

/** Draft: free markup on real components, exploring a home page after sign-in. */
export default function Prototype({ state }: PrototypeProps) {
  const done = state === "done";
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-4 p-6">
      <Badge variant="secondary">Draft</Badge>
      <Card>
        <CardHeader>
          <CardTitle>Hello, Ada</CardTitle>
          <CardDescription>
            {done ? "Your workspace is ready." : "Three steps to set up your workspace."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {steps.map((step, index) => (
            <div key={step} className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm">
                {index + 1}. {step}
              </span>
              <Button size="sm" variant={done ? "ghost" : "outline"} disabled={done}>
                {done ? "Done" : "Start"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
