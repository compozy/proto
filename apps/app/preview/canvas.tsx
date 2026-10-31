import type { PrototypeFrameProps } from "@compozy/proto";
import { Toaster } from "@proto/ui/components/toast";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { createContext, use, useState, type ReactNode } from "react";

const Canvas = createContext<ReactNode>(null);
function Content() {
  return use(Canvas);
}

/**
 * Providers around every story and prototype: a fresh memory router per canvas (links never
 * enter production loaders or change the preview URL) and toasts. No QueryClient or API client.
 */
export function PresentationCanvas({ children }: { children: ReactNode }) {
  const [router] = useState(() => {
    const root = createRootRoute({ component: Content });
    const catchAll = createRoute({ getParentRoute: () => root, path: "$" });
    return createRouter({
      routeTree: root.addChildren([catchAll]),
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
  });
  return (
    <Toaster>
      <Canvas value={children}>
        <RouterProvider router={router} />
      </Canvas>
    </Toaster>
  );
}

/**
 * The app's production chrome around component prototypes (not drafts or `standalone` ones),
 * fed with local fixtures for `route`, `role` and `state`. The template has no shell yet.
 */
export function PrototypeFrame({ children }: PrototypeFrameProps) {
  return children;
}
