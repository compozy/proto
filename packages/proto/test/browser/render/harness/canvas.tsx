/** `virtual:proto/canvas` of the protocol suite: markers for the wrapping assertions. */
import type { CanvasProps, FrameProps } from "../../../../src/contract.ts";

export function Canvas({ children, theme, role }: CanvasProps) {
  return (
    <div data-testid="canvas" data-theme={theme} data-role={role ?? ""}>
      {children}
    </div>
  );
}

export function Frame({ children, route, role, state }: FrameProps) {
  return (
    <div data-testid="frame" data-route={route} data-role={role ?? ""} data-state={state}>
      {children}
    </div>
  );
}
