/**
 * The shell's environment and data: `bootstrap.json` first (the only way the prebuilt shell
 * learns where it runs — no `import.meta.env`, no HMR client), then the registry snapshot from
 * `registryUrl`, refreshed on SSE `registry` events when `eventsUrl` is set. Other slices
 * subscribe to `comments` and `review` events through `useShellEvents`.
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

export async function loadBootstrap(
  base = document.baseURI,
  signal?: AbortSignal
): Promise<ShellEnv> {
  const response = await fetch(new URL(bootstrapHref, base), {
    headers: { accept: "application/json" },
    credentials: "same-origin",
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

export async function loadRegistry(env: ShellEnv, signal?: AbortSignal): Promise<Registry> {
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

export type ShellEventType = "registry" | "comments" | "review";
type EventListener = (data: { key?: string }) => void;

/**
 * One EventSource per shell, fanned out to subscribers by event type. It connects with the first
 * subscriber and closes with the last, so creating it has no side effect.
 */
export class ShellEvents {
  #listeners = new Map<ShellEventType, Set<EventListener>>();
  #source: EventSource | null = null;
  #url: string | null;

  constructor(url: string | null) {
    this.#url = url;
  }

  #connect() {
    if (!this.#url || this.#source) return;
    this.#source = new EventSource(new URL(this.#url, document.baseURI));
    for (const type of ["registry", "comments", "review"] as const) {
      this.#source.addEventListener(type, event => {
        let data: { key?: string } = {};
        try {
          const parsed: unknown = JSON.parse((event as MessageEvent<string>).data || "{}");
          if (parsed && typeof parsed === "object") data = parsed as { key?: string };
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
}

type RegistryState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; registry: Registry };

type ShellData = ShellEnv & { registry: RegistryState; events: ShellEvents; reload: () => void };

const ShellDataContext = createContext<ShellData | null>(null);

export const bootstrapQuery = () =>
  queryOptions({
    queryKey: ["bootstrap", new URL(bootstrapHref, document.baseURI).href],
    // Bootstrap belongs to this shell session; keep its request across StrictMode trial mounts.
    queryFn: () => loadBootstrap(),
    staleTime: Infinity,
  });

export const registryQuery = (env: ShellEnv) =>
  queryOptions({
    queryKey: ["registry", new URL(env.bootstrap.registryUrl, document.baseURI).href],
    queryFn: ({ signal }) => loadRegistry(env, signal),
    // Authored data changes through SSE. Static builds are immutable.
    staleTime: Infinity,
  });

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

function ShellDataContent({ env, children }: { env: ShellEnv; children: ReactNode }) {
  const client = useQueryClient();
  const [events] = useState(() => new ShellEvents(env.bootstrap.eventsUrl));
  const query = useQuery(registryQuery(env));
  useEffect(() => {
    return events.subscribe("registry", () => {
      void client.invalidateQueries({ queryKey: registryQuery(env).queryKey });
    });
  }, [client, env, events]);
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
