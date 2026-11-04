/**
 * The shell's environment and data: `bootstrap.json` first (the only way the prebuilt shell
 * learns where it runs — no `import.meta.env`, no HMR client), then the registry snapshot from
 * `registryUrl`, refreshed on SSE `registry` events when `eventsUrl` is set. Other slices
 * subscribe to `comments` and `review` events through `useShellEvents`. In a share (bootstrap
 * `snapshot`), `session` watches the served version and the session itself (`session-watch.ts`).
 */
import {
  QueryClientProvider,
  queryOptions,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { createContext, use, useEffect, useState, type ReactNode } from "react";

import { createShellQueryClient } from "./query";
import { SessionWatch } from "./session-watch";
import { useStore } from "@xstate/store-react";
import { previewLogic, PreviewSchedulerProvider } from "./preview-scheduler";

import { bootstrapSchema, type Bootstrap } from "../../model/bootstrap";
import type { Registry } from "../../model/registry";

/** Relative, so the shell works under any base path (static builds, remote `basePath`). */
export const bootstrapHref = "__proto/bootstrap.json";

export type ShellEnv = {
  bootstrap: Bootstrap;
  /** Absolute render base (bootstrap `renderUrl` resolved against the document). */
  renderUrl: string;
  /** The only origin render messages are accepted from. */
  renderOrigin: string;
};

/** Fetch and validate the shell bootstrap, resolving render URLs against the document base. */
async function loadBootstrap(base = document.baseURI, signal?: AbortSignal): Promise<ShellEnv> {
  const response = await fetch(new URL(bootstrapHref, base), {
    headers: { accept: "application/json" },
    credentials: "same-origin",
    // A share compares the live version against this page's; never answer from a cache.
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error(`bootstrap.json answered ${response.status}`);
  const bootstrap = bootstrapSchema.parse(await response.json());
  const renderUrl = new URL(bootstrap.renderUrl, base).href;
  return { bootstrap, renderUrl, renderOrigin: new URL(renderUrl).origin };
}

function isRegistry(value: unknown): value is Registry {
  if (!value || typeof value !== "object") return false;
  const { prototypes, flows, problems, warnings } = value as Record<string, unknown>;
  return [prototypes, flows, problems, warnings].every(Array.isArray);
}

/** Fetch a cancellable registry snapshot and reject unsuccessful or malformed responses. */
async function loadRegistry(env: ShellEnv, signal?: AbortSignal): Promise<Registry> {
  const url = new URL(env.bootstrap.registryUrl, document.baseURI);
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    credentials: "same-origin",
    signal,
  });
  if (!response.ok) throw new Error(`The registry answered ${response.status}`);
  const body: unknown = await response.json();
  if (!isRegistry(body)) throw new Error("The registry snapshot is malformed");
  return body;
}

export type ShellEventType = "registry" | "comments" | "review" | "snapshot";
/** `key` names a changed review; `id` the new version of a `snapshot` event. */
type EventData = { key?: string; id?: string };
type EventListener = (data: EventData) => void;

/** Consecutive failed reconnects (no `open` between them) that make a stream a session check. */
const lostAfter = 3;

/**
 * One EventSource per shell, fanned out to subscribers by event type. It connects with the first
 * subscriber and closes with the last, so creating it has no side effect. `onLost` runs when the
 * browser gives up reconnecting (the stream answered something other than events), and after
 * every `lostAfter` consecutive failed reconnects without an `open` (the network is gone, so the
 * browser keeps retrying in CONNECTING). A passing blip reopens before the budget runs out.
 */
class ShellEvents {
  #listeners = new Map<ShellEventType, Set<EventListener>>();
  #source: EventSource | null = null;
  #url: string | null;
  #onLost: ((events: ShellEvents) => void) | undefined;

  constructor(url: string | null, onLost?: (events: ShellEvents) => void) {
    this.#url = url;
    this.#onLost = onLost;
  }

  /** Open the shared event stream and reconcile observed data after a reconnect gap. */
  #connect(afterGap = false) {
    if (!this.#url || this.#source) return;
    const source = new EventSource(new URL(this.#url, document.baseURI));
    this.#source = source;
    let interrupted = afterGap;
    let failures = 0;
    source.addEventListener("error", () => {
      interrupted = true;
      if (this.#source !== source) return;
      if (source.readyState === EventSource.CLOSED) {
        this.#source = null;
        this.#onLost?.(this);
        return;
      }
      failures += 1;
      if (failures < lostAfter) return;
      failures = 0;
      this.#onLost?.(this);
    });
    source.addEventListener("open", () => {
      failures = 0;
      if (!interrupted) return;
      interrupted = false;
      // The server does not replay missed events. Reconcile every observed slice after a gap.
      for (const listeners of this.#listeners.values())
        for (const listener of listeners) listener({});
    });
    for (const type of ["registry", "comments", "review", "snapshot"] as const) {
      source.addEventListener(type, event => {
        let data: EventData = {};
        try {
          const parsed: unknown = JSON.parse((event as MessageEvent<string>).data || "{}");
          if (parsed && typeof parsed === "object") data = parsed as EventData;
        } catch {
          // An event without a JSON body still means "refetch".
        }
        for (const listener of this.#listeners.get(type) ?? []) listener(data);
      });
    }
  }

  subscribe(type: ShellEventType, listener: EventListener) {
    const listeners = this.#listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(type, listeners);
    this.#connect();
    return () => {
      listeners.delete(listener);
      if ([...this.#listeners.values()].every(set => set.size === 0)) {
        this.#source?.close();
        this.#source = null;
      }
    };
  }

  /** Reopen a stream the browser closed, reconciling every subscriber once it is back. */
  reconnect() {
    if ([...this.#listeners.values()].some(set => set.size > 0)) this.#connect(true);
  }
}

type RegistryState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; registry: Registry };

type ShellData = ShellEnv & {
  registry: RegistryState;
  events: ShellEvents;
  session: SessionWatch;
  reload: () => void;
};

const ShellDataContext = createContext<ShellData | null>(null);

const bootstrapQuery = () =>
  queryOptions({
    queryKey: ["bootstrap", new URL(bootstrapHref, document.baseURI).href],
    // Bootstrap belongs to this shell session; keep its request across StrictMode trial mounts.
    queryFn: () => loadBootstrap(),
    staleTime: Infinity,
  });

export function useBootstrap() {
  return useQuery(bootstrapQuery());
}

const registryQuery = (env: ShellEnv) =>
  queryOptions({
    queryKey: ["registry", new URL(env.bootstrap.registryUrl, document.baseURI).href],
    queryFn: ({ signal }) => loadRegistry(env, signal),
    // Authored data changes through SSE. Static builds are immutable.
    staleTime: Infinity,
  });

/** Own query and preview-scheduler lifetimes for one mounted gallery surface. */
export function ShellDataProvider({
  env,
  client,
  children,
}: {
  env: ShellEnv;
  client?: QueryClient;
  children: ReactNode;
}) {
  const [ownedClient] = useState(createShellQueryClient);
  const scheduler = useStore(previewLogic);
  return (
    <QueryClientProvider client={client ?? ownedClient}>
      <PreviewSchedulerProvider value={scheduler}>
        <ShellDataContent env={env}>{children}</ShellDataContent>
      </PreviewSchedulerProvider>
    </QueryClientProvider>
  );
}

/** Keep the registry query fresh from SSE while retaining the last successful snapshot on failure. */
function ShellDataContent({ env, children }: { env: ShellEnv; children: ReactNode }) {
  const client = useQueryClient();
  const [session] = useState(
    () =>
      new SessionWatch(
        env.bootstrap.snapshot,
        async () => (await loadBootstrap()).bootstrap.snapshot ?? null
      )
  );
  // A stream the browser stopped retrying, or one that keeps failing to reconnect, is a session
  // check; a live session reopens a closed stream (one still retrying is left to the browser).
  const [events] = useState(
    () =>
      new ShellEvents(env.bootstrap.eventsUrl, stream => session.failure(() => stream.reconnect()))
  );
  const query = useQuery(registryQuery(env));
  useEffect(() => {
    return events.subscribe("registry", () => {
      void client.invalidateQueries({ queryKey: registryQuery(env).queryKey });
    });
  }, [client, env, events]);
  useEffect(() => {
    // A new version, or a reconnect after a gap (listeners receive `{}`): compare versions.
    if (!session.snapshot) return;
    return events.subscribe("snapshot", () => session.compare());
  }, [events, session]);
  // Structural sharing keeps unchanged prototypes/flows stable across registry events.
  // A failed refresh leaves the last successful registry on screen.
  const registry: RegistryState = query.data
    ? { status: "ready", registry: query.data }
    : query.error
      ? { status: "error", message: String(query.error) }
      : { status: "loading" };
  return (
    <ShellDataContext
      value={{
        ...env,
        registry,
        events,
        session,
        reload: () => {
          void query.refetch();
        },
      }}
    >
      {children}
    </ShellDataContext>
  );
}

export function useShellData() {
  const data = use(ShellDataContext);
  if (!data) throw new Error("useShellData outside ShellDataProvider");
  return data;
}

/** The loaded registry; only valid under the ready branch of the app. */
export function useRegistry() {
  const { registry } = useShellData();
  if (registry.status !== "ready") throw new Error("The registry is not loaded");
  return registry.registry;
}

/** Subscribe to an SSE event type (`comments`, `review`) for as long as the caller is mounted. */
export function useShellEvent(type: ShellEventType, listener: EventListener) {
  const { events } = useShellData();
  useEffect(() => events.subscribe(type, listener), [events, type, listener]);
}
