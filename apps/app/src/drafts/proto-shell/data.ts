/** Fixtures for the gallery-shell exploration: the template's real catalog plus two sample specs. */

export type NodeKind = "start" | "screen" | "overlay" | "redirect" | "external" | "end";
export type EdgeKind = "navigate" | "overlay" | "redirect" | "external";

export type ShellComment = {
  id: number;
  author: string;
  role: "reviewer" | "agent";
  initials: string;
  at: string;
  text: string;
  state: string;
  pin?: { x: number; y: number };
  source?: string;
  replies?: {
    author: string;
    role: "reviewer" | "agent";
    initials: string;
    at: string;
    text: string;
  }[];
  resolved?: boolean;
};

export type FlowStep = {
  id: string;
  kind: NodeKind;
  title: string;
  subtitle: string;
  proto?: string;
  state?: string;
  route?: string;
  comments: number;
  uncovered?: boolean;
  x: number;
  y: number;
};

export type FlowLink = { from: string; to: string; on: string; kind: EdgeKind };

export const app = { name: "Proto", commit: "a41c9e2" };

export const specs = [
  {
    id: "auth",
    title: "Authentication",
    flows: 1,
    screens: 2,
    states: 6,
    open: 3,
    approved: false,
    updated: "4 min ago",
    preview: "/login-form?state=sign-in&chrome=0",
  },
  {
    id: "onboarding",
    title: "Onboarding",
    flows: 2,
    screens: 3,
    states: 9,
    open: 1,
    approved: false,
    updated: "2 h ago",
    preview: "/welcome?state=default&chrome=0",
  },
  {
    id: "billing",
    title: "Billing",
    flows: 1,
    screens: 4,
    states: 12,
    open: 0,
    approved: true,
    updated: "yesterday",
    preview: "/welcome?state=done&chrome=0",
  },
] as const;

export const loginForm = {
  slug: "login-form",
  title: "Sign in",
  spec: "auth",
  surface: "A1",
  route: "/login",
  kind: "component" as const,
  states: [
    { id: "sign-in", label: "Sign in", comments: 0 },
    { id: "sign-up", label: "Create account", comments: 1 },
    { id: "error", label: "Wrong password", comments: 2 },
    { id: "pending", label: "Submitting", comments: 0 },
  ],
};

export const screens = [
  loginForm,
  {
    slug: "welcome",
    title: "Welcome home",
    spec: "auth",
    surface: "D1",
    route: "/",
    kind: "draft" as const,
    states: [
      { id: "default", label: "First steps", comments: 0 },
      { id: "done", label: "All done", comments: 0 },
    ],
  },
];

export const flow = {
  id: "sign-in",
  title: "Sign in",
  spec: "auth",
  description: "From the website to the home page, through sign-in or a new account.",
  steps: [
    {
      id: "site",
      kind: "start",
      title: "Website",
      subtitle: "example.com · outside the app",
      comments: 0,
      x: 0,
      y: 250,
    },
    {
      id: "sign-in",
      kind: "screen",
      title: "Sign in",
      subtitle: "/login · sign-in",
      proto: "login-form",
      state: "sign-in",
      route: "/login",
      comments: 0,
      x: 340,
      y: 250,
    },
    {
      id: "sign-up",
      kind: "overlay",
      title: "Create account",
      subtitle: "/login · sign-up",
      proto: "login-form",
      state: "sign-up",
      route: "/login",
      comments: 1,
      x: 700,
      y: -40,
    },
    {
      id: "pending",
      kind: "overlay",
      title: "Submitting",
      subtitle: "/login · pending",
      proto: "login-form",
      state: "pending",
      route: "/login",
      comments: 0,
      x: 700,
      y: 420,
    },
    {
      id: "error",
      kind: "overlay",
      title: "Wrong password",
      subtitle: "/login · error",
      proto: "login-form",
      state: "error",
      route: "/login",
      comments: 2,
      x: 1060,
      y: 420,
    },
    {
      id: "home",
      kind: "end",
      title: "Welcome home",
      subtitle: "/ · default",
      proto: "welcome",
      state: "default",
      route: "/",
      comments: 0,
      uncovered: true,
      x: 1060,
      y: -40,
    },
  ] satisfies FlowStep[],
  links: [
    { from: "site", to: "sign-in", on: "Sign in", kind: "navigate" },
    { from: "sign-in", to: "sign-up", on: "No account?", kind: "overlay" },
    { from: "sign-up", to: "sign-in", on: "Have an account?", kind: "overlay" },
    { from: "sign-in", to: "pending", on: "Submit", kind: "overlay" },
    { from: "sign-up", to: "pending", on: "Submit", kind: "overlay" },
    { from: "pending", to: "error", on: "Wrong password", kind: "overlay" },
    { from: "error", to: "pending", on: "Submit again", kind: "overlay" },
    { from: "pending", to: "home", on: "Signed in", kind: "redirect" },
  ] satisfies FlowLink[],
};

export const comments: ShellComment[] = [
  {
    id: 7,
    author: "Pedro Nauck",
    role: "reviewer",
    initials: "PN",
    at: "4 min ago",
    state: "error",
    pin: { x: 51.5, y: 55 },
    source: "login-form.tsx:58:27",
    text: "The error should sit under the password field, not above the button. Feels detached.",
    replies: [
      {
        author: "open-design-designer",
        role: "agent",
        initials: "OD",
        at: "2 min ago",
        text: "Moved it into the password Field as a description with aria-describedby. Screenshot attached on the dark theme at 1440.",
      },
    ],
  },
  {
    id: 6,
    author: "Pedro Nauck",
    role: "reviewer",
    initials: "PN",
    at: "12 min ago",
    state: "error",
    pin: { x: 41.6, y: 27.6 },
    source: "login-form.tsx:31:11",
    text: 'Keep the title as "Sign in" in the error state, the user is still signing in.',
  },
  {
    id: 5,
    author: "Ana Lima",
    role: "reviewer",
    initials: "AL",
    at: "1 h ago",
    state: "sign-up",
    pin: { x: 50, y: 42 },
    source: "login-form.tsx:44:13",
    text: "Name first, then email. Do we need a password confirmation here?",
  },
  {
    id: 3,
    author: "Pedro Nauck",
    role: "reviewer",
    initials: "PN",
    at: "yesterday",
    state: "sign-in",
    text: "Primary button full width, good.",
    resolved: true,
  },
];

export const kindLabel: Record<NodeKind, string> = {
  start: "Start",
  screen: "Screen",
  overlay: "Same screen",
  redirect: "Redirect",
  external: "External",
  end: "End",
};

export function previewUrl(slug: string, state: string, theme?: "light" | "dark") {
  return `/${slug}?state=${state}${theme ? `&theme=${theme}` : ""}&chrome=0`;
}
