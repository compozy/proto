/**
 * Unsent composer drafts survive a reload and an expired session (S18, IT-029): they live in
 * `localStorage` under `proto:draft:<scope>` until the message is sent or discarded. Only the
 * text is kept; pending uploads are server state and expire on their own.
 */
import { useState, useSyncExternalStore } from "react";

const prefix = "proto:draft:";
/** Dispatched on `window` after this document changes a draft. */
const changeEvent = "proto:draft";

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
  window.dispatchEvent(new Event(changeEvent));
}

/** Whether any composer holds unsent text (a reload or an ended session would interrupt it). */
export function hasUnsentDraft() {
  try {
    const storage = window.localStorage;
    for (let index = 0; index < storage.length; index++) {
      const name = storage.key(index);
      if (name?.startsWith(prefix) && storage.getItem(name)) return true;
    }
  } catch {
    // Without storage no draft survives anyway.
  }
  return false;
}

function subscribe(onChange: () => void) {
  window.addEventListener(changeEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(changeEvent, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** `hasUnsentDraft`, live across composers and tabs. */
export function useUnsentDraft() {
  return useSyncExternalStore(subscribe, hasUnsentDraft);
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
