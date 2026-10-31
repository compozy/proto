import { definePrototype } from "@compozy/proto";
export const meta = definePrototype({
  title: "Welcome",
  states: [{ id: "default", label: "Welcome" }],
});
export default function Welcome() {
  return <main>Welcome to Proto</main>;
}
