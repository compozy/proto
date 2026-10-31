import { defineFlow } from "@compozy/proto/flow";

export const flow = defineFlow({
  title: "Sign in",
  spec: "auth",
  description: "From the website to the home page, through sign-in or a new account.",
  start: ["site"],
  nodes: {
    site: { external: "site", url: "/" },
    "sign-in": { proto: "login-form", state: "sign-in" },
    "sign-up": { proto: "login-form", state: "sign-up" },
    pending: { proto: "login-form", state: "pending" },
    error: { proto: "login-form", state: "error" },
    home: { proto: "welcome", state: "default", end: true },
  },
  edges: [
    ["site", "sign-in", { on: "Sign in" }],
    ["sign-in", "sign-up", { on: "No account? Create one", kind: "overlay" }],
    ["sign-up", "sign-in", { on: "Have an account? Sign in", kind: "overlay" }],
    ["sign-in", "pending", { on: "Submit", kind: "overlay" }],
    ["sign-up", "pending", { on: "Submit", kind: "overlay" }],
    ["pending", "error", { on: "Wrong password", kind: "overlay" }],
    ["error", "pending", { on: "Submit again", kind: "overlay" }],
    ["pending", "home", { on: "Signed in", kind: "redirect" }],
  ],
});
