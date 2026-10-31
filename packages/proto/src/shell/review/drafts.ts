/**
 * Unsent composer drafts survive a reload and an expired session (S18, IT-029): they live in
 * `localStorage` under `proto:draft:<scope>` until the message is sent or discarded. Only the
 * text is kept; pending uploads are server state and expire on their own.
 */
import { useState } from "react";

const prefix = "proto:draft:";

function read(scope: string) {
  try {
    return window.localStorage.getItem(prefix + scope) ?? "";
  } catch {
    return "";
  }
}

function write(scope: string, value: string) {
  try {
    if (value) window.localStorage.setItem(prefix + scope, value);
    else window.localStorage.removeItem(prefix + scope);
  } catch {
    // Storage may be unavailable (private mode); the draft then lives only in memory.
  }
}

/** A text draft persisted per scope (`reply:<comment id>`, `new:<key>`). */
export function useDraft(scope: string) {
  const [state, setState] = useState(() => ({ scope, value: read(scope) }));
  const current = state.scope === scope ? state.value : read(scope);
  if (state.scope !== scope) setState({ scope, value: current });
  const set = (value: string) => {
    write(scope, value);
    setState({ scope, value });
  };
  return [current, set, () => set("")] as const;
}
