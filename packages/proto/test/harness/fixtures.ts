/**
 * Fixture registry and bootstrap for the shell harness and the shell browser tests: the shape
 * W1's `GET registry` serves, with specs, unsorted prototypes, drafts, roles, a flow with an
 * external start, a flow with problems, warnings and a state that throws in the fake render host.
 */
import type { Bootstrap } from "../../src/model/bootstrap";
import type { Registry, RegistryFlow, RegistryPrototype } from "../../src/model/registry";

const loginForm: RegistryPrototype = {
  slug: "login-form",
  kind: "component",
  file: "src/components/login-form.proto.tsx",
  title: "Sign in",
  spec: "auth",
  surface: "A1",
  route: "/login",
  blocks: [],
  roles: [],
  standalone: true,
  states: [
    { id: "sign-in", label: "Sign in" },
    { id: "sign-up", label: "Create account" },
    { id: "error", label: "Wrong password" },
    { id: "pending", label: "Submitting" },
    { id: "throws", label: "Broken render" },
  ],
};

const welcome: RegistryPrototype = {
  slug: "welcome",
  kind: "draft",
  file: "src/drafts/welcome/index.proto.tsx",
  title: "Welcome home",
  spec: null,
  surface: "D1",
  route: "/",
  blocks: [],
  roles: [],
  standalone: false,
  states: [
    { id: "default", label: "First steps" },
    { id: "done", label: "All done" },
  ],
};

const invoice: RegistryPrototype = {
  slug: "invoice",
  kind: "component",
  file: "src/systems/billing/invoice.proto.tsx",
  title: "Invoice",
  spec: "billing",
  surface: "B2",
  route: "/billing/invoice",
  blocks: [],
  roles: ["member", "admin"],
  standalone: false,
  states: [
    { id: "open", label: "Open" },
    { id: "paid", label: "Paid" },
  ],
};

const settingsCard: RegistryPrototype = {
  slug: "settings-card",
  kind: "component",
  file: "src/components/settings-card.proto.tsx",
  title: "Settings card",
  spec: null,
  surface: null,
  route: null,
  blocks: [],
  roles: [],
  standalone: true,
  states: [{ id: "default", label: "Default" }],
};

const signIn: RegistryFlow = {
  id: "sign-in",
  file: "flows/sign-in.flow.ts",
  title: "Sign in",
  description: "From the website to the home page, through sign-in or a new account.",
  spec: "auth",
  start: ["site"],
  specs: ["auth"],
  steps: 6,
  nodes: [
    {
      id: "site",
      kind: "external",
      external: "site",
      label: "Website",
      url: "https://example.com/",
      start: true,
      end: false,
      step: 1,
    },
    {
      id: "sign-in",
      kind: "prototype",
      proto: "login-form",
      state: "sign-in",
      stateLabel: "Sign in",
      title: "Sign in",
      route: "/login",
      spec: "auth",
      start: false,
      end: false,
      step: 2,
    },
    {
      id: "sign-up",
      kind: "prototype",
      proto: "login-form",
      state: "sign-up",
      stateLabel: "Create account",
      title: "Sign in",
      route: "/login",
      spec: "auth",
      start: false,
      end: false,
      step: 3,
    },
    {
      id: "pending",
      kind: "prototype",
      proto: "login-form",
      state: "pending",
      stateLabel: "Submitting",
      title: "Sign in",
      route: "/login",
      spec: "auth",
      start: false,
      end: false,
      step: 4,
    },
    {
      id: "error",
      kind: "prototype",
      proto: "login-form",
      state: "error",
      stateLabel: "Wrong password",
      title: "Sign in",
      route: "/login",
      spec: "auth",
      start: false,
      end: false,
      step: 5,
    },
    {
      id: "home",
      kind: "prototype",
      proto: "welcome",
      state: "default",
      stateLabel: "First steps",
      title: "Welcome home",
      route: "/",
      spec: null,
      start: false,
      end: true,
      step: 6,
    },
  ],
  edges: [
    { from: "site", to: "sign-in", on: "Sign in", kind: "navigate" },
    { from: "sign-in", to: "sign-up", on: "No account?", kind: "overlay" },
    { from: "sign-up", to: "sign-in", on: "Have an account?", kind: "overlay" },
    { from: "sign-in", to: "pending", on: "Submit", kind: "overlay" },
    { from: "sign-up", to: "pending", on: "Submit", kind: "overlay" },
    { from: "pending", to: "error", on: "Wrong password", kind: "overlay" },
    { from: "error", to: "pending", on: "Submit again", kind: "overlay" },
    { from: "pending", to: "home", on: "Signed in", kind: "redirect" },
  ],
};

const checkout: RegistryFlow = {
  id: "checkout",
  file: "flows/checkout.flow.ts",
  title: "Checkout",
  description: null,
  spec: "billing",
  start: ["open"],
  specs: ["billing"],
  steps: 2,
  nodes: [
    {
      id: "open",
      kind: "prototype",
      proto: "invoice",
      state: "open",
      stateLabel: "Open",
      title: "Invoice",
      route: "/billing/invoice",
      spec: "billing",
      start: true,
      end: false,
      step: 1,
    },
    {
      id: "paid",
      kind: "prototype",
      proto: "invoice",
      state: "paid",
      stateLabel: "Paid",
      title: "Invoice",
      route: "/billing/invoice",
      spec: "billing",
      start: false,
      end: true,
      step: 2,
    },
  ],
  edges: [{ from: "open", to: "paid", on: "Pay", kind: "navigate" }],
};

export const registry: Registry = {
  title: "Acme",
  locale: "en",
  specs: { auth: "Authentication", billing: "Billing", onboarding: "Onboarding" },
  roles: { member: "Member", admin: "Admin" },
  siteUrl: "https://example.com",
  prototypes: [loginForm, invoice, settingsCard, welcome],
  flows: [signIn, checkout],
  problems: [
    {
      code: "markup",
      file: "src/systems/billing/invoice.proto.tsx",
      line: 14,
      column: 7,
      slug: "invoice",
      message: "Component prototypes compose views; move <div> into the view or use a draft.",
    },
    {
      code: "unknown_state",
      file: "flows/checkout.flow.ts",
      flow: "checkout",
      node: "paid",
      message: 'Node "paid" uses state "done" that invoice has not declared.',
    },
  ],
  warnings: [
    {
      code: "uncovered_state",
      file: "flows/sign-in.flow.ts",
      proto: "welcome",
      state: "done",
      message: 'welcome state "done" is in no flow.',
    },
  ],
};

export const emptyRegistry: Registry = {
  ...registry,
  prototypes: [],
  flows: [],
  problems: [],
  warnings: [],
};

export function bootstrapFor(options: {
  mode?: Bootstrap["mode"];
  locale?: Bootstrap["locale"];
  renderUrl: string;
  registryUrl?: string;
  eventsUrl?: string | null;
}): Bootstrap {
  const mode = options.mode ?? "dev";
  return {
    mode,
    title: "Acme",
    locale: options.locale ?? "en",
    commit: "a41c9e2f0b7d4c6e8a1b2c3d4e5f60718293a4b5",
    apiBase: mode === "read-only" ? null : "/__proto/api/",
    eventsUrl:
      options.eventsUrl === undefined
        ? mode === "read-only"
          ? null
          : "/__proto/api/events"
        : options.eventsUrl,
    renderUrl: options.renderUrl,
    registryUrl:
      options.registryUrl ??
      (mode === "read-only" ? "__proto/registry.json" : "/__proto/api/registry"),
    reviewSnapshotBase: null,
    principal: null,
    signInUrl: null,
  };
}
