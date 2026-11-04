import { createElement, Fragment, useLayoutEffect, type ReactNode } from "react";

/** Notify the host only after React has committed the story subtree. */
export function RenderCommit({
  children,
  onCommit,
}: {
  children: ReactNode;
  onCommit: () => void;
}) {
  useLayoutEffect(() => onCommit(), [onCommit]);
  return createElement(Fragment, null, children);
}
