import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";

import { authClient } from "./lib/auth-client";
import { Home } from "./routes/home";
import { Login } from "./routes/login";

async function hasSession() {
  const { data } = await authClient.getSession();
  return Boolean(data);
}

const rootRoute = createRootRoute({ component: Outlet });

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: async () => {
    if (!(await hasSession())) throw redirect({ to: "/login" });
  },
  component: Home,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  beforeLoad: async () => {
    if (await hasSession()) throw redirect({ to: "/" });
  },
  component: Login,
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([homeRoute, loginRoute]),
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
