/**
 * Source locations (`data-proto-src`, `target.source`, `sourceChain`): app-relative POSIX
 * `<path>:<line>:<column>`. The shell, the render host and the review router confine every path
 * to the registry's source roots (Safety Invariant 7); a forged path never reaches an agent.
 * Pure: no Node, no DOM.
 */

import { ProtoError } from "./errors.ts";

/** Default source roots of an app: `src/`, `flows/` and the canvas file. */
export type SourceRoots = { dirs: readonly string[]; files: readonly string[] };

export function sourceRoots(options: { flows?: string; canvas?: string } = {}): SourceRoots {
  const trim = (path: string) => path.replace(/^\.\//, "").replace(/\/+$/, "");
  return {
    dirs: ["src", trim(options.flows ?? "flows")],
    files: [trim(options.canvas ?? "proto.canvas.tsx")],
  };
}

const location = /^(?<path>[^:]+?)(?::(?<line>\d+)(?::(?<column>\d+))?)?$/;

/**
 * Returns the normalized location, or null when it is not a confined app-relative path:
 * absolute, scheme-prefixed, backslashes, `..` or `.` segments, or outside `roots`.
 */
export function normalizeSource(value: string, roots: SourceRoots): string | null {
  if (!value || value.length > 1000) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) || /^[a-z]:/i.test(value)) return null;
  if (value.startsWith("/") || value.includes("\\") || value.includes("\0")) return null;
  const match = location.exec(value);
  const path = match?.groups?.path;
  if (!path) return null;
  const segments = path.split("/");
  if (segments.some(segment => segment === "" || segment === "." || segment === "..")) return null;
  const inside = roots.files.includes(path) || roots.dirs.some(dir => path.startsWith(`${dir}/`));
  return inside ? value : null;
}

/** Router and shell form: throws `invalid_source` instead of returning null. */
export function confineSource(value: string, roots: SourceRoots): string {
  const normalized = normalizeSource(value, roots);
  if (normalized === null) throw new ProtoError("invalid_source");
  return normalized;
}
