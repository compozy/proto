/**
 * `virtual:proto/render-config` of the protocol suite. Like `proto dev` (render = shell port + 1),
 * the shell origin derives from the render host's own origin — the suite's page on 127.0.0.1 —
 * and never from the URL. The harness page is the static query form (`index.html?slug=`).
 */
import type { RenderConfig } from "../../../../src/model/render-host.ts";

export const renderConfig: RenderConfig = {
  mode: "dev",
  shellOrigin: `http://127.0.0.1:${window.location.port}`,
  form: "query",
};
