/**
 * The runtime `@compozy/proto` exports. The render origin resolves the bare package to this file,
 * so prototypes share the URL-state module the host subscribes to (one `setParam` listener set)
 * and the optimizer never discovers the package after the first prototype import.
 */
import type { PrototypeMeta } from "../contract.ts";

export function definePrototype<const Meta extends PrototypeMeta>(meta: Meta): Meta {
  return meta;
}

export { protoHref, setParam, setParams, useSearch } from "./url-state.ts";
