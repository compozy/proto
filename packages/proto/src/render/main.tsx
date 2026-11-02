/**
 * Render host entry, compiled by the consumer's Vite on the render origin: the HTML the plugin
 * serves at `/__proto/render/<slug>` (or the static `index.html?slug=`) loads it into `#root`.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, Frame } from "virtual:proto/canvas";
import { prototypes } from "virtual:proto/prototypes";
import { renderConfig } from "virtual:proto/render-config";

import { RenderHost } from "./host.tsx";

const root = document.getElementById("root");
if (root) {
  const renderer = createRoot(root);
  const render = (entries: typeof prototypes) =>
    renderer.render(
      <StrictMode>
        <RenderHost config={renderConfig} prototypes={entries} Canvas={Canvas} Frame={Frame} />
      </StrictMode>
    );
  render(prototypes);
  if (import.meta.hot) {
    import.meta.hot.accept("virtual:proto/prototypes", module => {
      if (module) render(module.prototypes);
    });
  }
}
