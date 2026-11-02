import type { View } from "./view";

export const loadFlowPage = () =>
  import("../flow/flow-page").then(module => ({ default: module.FlowPage }));
export const loadSettings = () =>
  import("../review/settings/settings").then(module => ({ default: module.Settings }));

/** Intent warms expensive route code without evaluating the consumer's prototype modules. */
export function preloadView(view: View) {
  if (view.area === "flow") void loadFlowPage().catch(() => {});
  if (view.area === "settings") void loadSettings().catch(() => {});
}
