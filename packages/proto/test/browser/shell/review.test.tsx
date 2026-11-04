/**
 * The shell's review client and the review controls it renders: the client's request contract
 * (cookie writes carry `X-Proto-Request`, a 401 `auth_required` reaches the session-expired
 * handler, failures keep their registry code), the UI restatement of the authorization matrix,
 * and the remote Credentials section (S17: created token shown once, revoke), and the shell side
 * of a share (proto-share `_uiux.md` S1, S3–S5). The network is the faked I/O boundary;
 * everything above it is the real shell code.
 */
import "../../../src/shell/theme.css";

import { act, useEffect, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { QueryObserver } from "@tanstack/react-query";

import type { Bootstrap } from "../../../src/model/bootstrap.ts";
import { LocaleProvider } from "../../../src/shell/lib/i18n.tsx";
import {
  ShellDataProvider,
  useShellData,
  type ShellEnv,
} from "../../../src/shell/lib/shell-data.tsx";
import { createReviewApi, isReviewApiError } from "../../../src/shell/review/api.ts";
import { ReviewProvider } from "../../../src/shell/review/data.tsx";
import { createShellQueryClient } from "../../../src/shell/lib/query.ts";
import {
  createReviewQueries,
  createReviewInvalidator,
  invalidateReview,
} from "../../../src/shell/review/queries.ts";
import { permissionsOf } from "../../../src/shell/review/permissions.ts";
import { confinePick } from "../../../src/shell/review/comment-mode/pick.ts";
import { registrySourceRoots } from "../../../src/shell/lib/registry-model.ts";
import { Settings } from "../../../src/shell/review/settings/settings.tsx";
import { ReviewActions } from "../../../src/shell/review/approval/approval.tsx";
import { SessionWatch } from "../../../src/shell/lib/session-watch.ts";
import { SessionNotice } from "../../../src/shell/app/session-notice.tsx";
import { useDraft } from "../../../src/shell/review/drafts.ts";
import { ShellRail } from "../../../src/shell/app/chrome.tsx";
import { bootstrapFor, registry } from "../../harness/fixtures.ts";

type Call = { method: string; url: string; headers: Headers; body: string | null };

function fakeFetch(answer: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const call = {
      method: init.method ?? "GET",
      url: String(input),
      headers: new Headers(init.headers),
      body: typeof init.body === "string" ? init.body : null,
    };
    calls.push(call);
    return answer(call);
  };
  return { calls, fetch: fetch as typeof globalThis.fetch };
}

const json = (body: unknown, status = 200) => Response.json(body, { status });

describe("review query ownership", () => {
  test("paired events and mutation settlement share one refresh without losing later edits", async () => {
    // Invariant: a notification burst is one read; an edit during that read is reconciled afterward.
    // Owner: review query lifecycle. Only the HTTP response boundary is delayed.
    let open = 0;
    let release: (() => void) | undefined;
    const network = fakeFetch(async () => {
      const snapshot = open;
      if (snapshot === 1)
        await new Promise<void>(resolve => {
          release = resolve;
        });
      return json({
        review: { key: "one", status: "in_review", updatedAt: null, open: snapshot, events: [] },
      });
    });
    const api = createReviewApi({ apiBase: "http://127.0.0.1/api/", fetch: network.fetch });
    const client = createShellQueryClient();
    const queries = createReviewQueries(api, "local");
    const refresh = createReviewInvalidator(client, queries);
    const observer = new QueryObserver(client, queries.state("one"));
    const stop = observer.subscribe(() => {});
    try {
      await client.fetchQuery(queries.state("one"));
      open = 1;
      const burst = [refresh("one"), refresh("one"), refresh("one")];
      await vi.waitFor(() => expect(release).toBeDefined());
      expect(network.calls).toHaveLength(2);
      open = 2;
      const later = refresh("one");
      release!();
      await Promise.all([...burst, later]);
      expect(client.getQueryData(queries.state("one").queryKey)?.open).toBe(2);
      expect(network.calls).toHaveLength(3);
    } finally {
      release?.();
      stop();
      client.clear();
    }
  });

  test("a review change retains cached data and invalidates only its dependent reads", async () => {
    // Invariant: a key change refreshes its detail and matching lists, not unrelated reviews.
    // Owner: review data queries; canonical browser client suite, mocked only at HTTP.
    let open = 0;
    const network = fakeFetch(call => {
      const url = new URL(call.url);
      return url.pathname.includes("/reviews/")
        ? json({
            review: {
              key: url.pathname.split("/").at(-1),
              status: "in_review",
              updatedAt: null,
              open,
              events: [],
            },
          })
        : json({ comments: [] });
    });
    const api = createReviewApi({ apiBase: "http://127.0.0.1/api/", fetch: network.fetch });
    const client = createShellQueryClient();
    const queries = createReviewQueries(api, "local");
    const reads = [queries.state("one"), queries.state("two")];
    try {
      await Promise.all(reads.map(read => client.fetchQuery(read)));
      await client.fetchQuery(queries.comments({ status: "all" }));
      await client.fetchQuery(queries.comments({ key: "two", status: "all" }));
      open = 1;
      await invalidateReview(client, queries, "one");
      expect(client.getQueryData(queries.state("one").queryKey)?.open).toBe(0);
      const states = await Promise.all(reads.map(read => client.fetchQuery(read)));
      await client.fetchQuery(queries.comments({ status: "all" }));
      await client.fetchQuery(queries.comments({ key: "two", status: "all" }));
      expect(states.map(state => state.open)).toEqual([1, 0]);
      const count = (path: string) =>
        network.calls.filter(call => new URL(call.url).pathname + new URL(call.url).search === path)
          .length;
      expect(count("/api/reviews/one")).toBe(2);
      expect(count("/api/reviews/two")).toBe(1);
      expect(count("/api/comments?status=all")).toBe(2);
      expect(count("/api/comments?key=two&status=all")).toBe(1);
    } finally {
      client.clear();
    }
  });

  test("intent prefetch and concurrent detail readers share one request and fresh result", async () => {
    // Invariant: all readers of one review share the canonical query, including prefetch.
    const network = fakeFetch(() =>
      json({ review: { key: "one", status: "in_review", updatedAt: null, open: 0, events: [] } })
    );
    const api = createReviewApi({ apiBase: "http://127.0.0.1/api/", fetch: network.fetch });
    const queries = createReviewQueries(api, "local");
    const client = createShellQueryClient();
    try {
      await Promise.all([
        client.prefetchQuery(queries.state("one")),
        client.fetchQuery(queries.state("one")),
        client.fetchQuery(queries.state("one")),
      ]);
      expect((await client.fetchQuery(queries.state("one"))).key).toBe("one");
      expect(network.calls).toHaveLength(1);
    } finally {
      client.clear();
    }
  });
});

describe("createReviewApi", () => {
  const base = "http://127.0.0.1:4400/";

  test("writes carry X-Proto-Request and same-origin credentials; reads do not", async () => {
    const network = fakeFetch(call =>
      call.method === "GET" ? json({ comments: [] }) : new Response(null, { status: 204 })
    );
    const api = createReviewApi({ apiBase: "/__proto/api/", base, fetch: network.fetch });
    await api.listComments({ key: "login-form", status: "open" });
    await api.deleteComment("login-form-3");
    const [read, write] = network.calls;
    expect(read?.url).toBe(`${base}__proto/api/comments?key=login-form&status=open`);
    expect(read?.headers.get("X-Proto-Request")).toBeNull();
    expect(write).toMatchObject({
      method: "DELETE",
      url: `${base}__proto/api/comments/login-form-3`,
    });
    expect(write?.headers.get("X-Proto-Request")).toBe("1");
    expect(write?.headers.get("authorization")).toBeNull();
  });

  test("a 401 auth_required reports the sign-in URL and rejects with its code", async () => {
    const expired = vi.fn();
    const network = fakeFetch(() =>
      json(
        {
          error: {
            code: "auth_required",
            message: "Sign in to review.",
            signInUrl: "/proto/sign-in?returnTo=%2Fproto%2F",
          },
        },
        401
      )
    );
    const api = createReviewApi({
      apiBase: "/proto/api/",
      base,
      fetch: network.fetch,
      onAuthRequired: expired,
    });
    const failure = await api
      .reply("login-form-1", { body: "Done." })
      .catch((error: unknown) => error);
    expect(isReviewApiError(failure, "auth_required")).toBe(true);
    expect(expired).toHaveBeenCalledWith("/proto/sign-in?returnTo=%2Fproto%2F");
  });

  test("an approval refused for open comments keeps the registry code", async () => {
    const network = fakeFetch(() =>
      json({ error: { code: "review_has_open_comments", message: "2 comments are open." } }, 409)
    );
    const api = createReviewApi({ apiBase: "/__proto/api/", base, fetch: network.fetch });
    const failure = await api.transition("login-form", "approved").catch((error: unknown) => error);
    expect(isReviewApiError(failure, "review_has_open_comments")).toBe(true);
    expect(JSON.parse(network.calls[0]?.body ?? "{}")).toEqual({ to: "approved" });
  });
});

describe("permissionsOf (UI restatement of the authorization matrix)", () => {
  const remote = (principal: Bootstrap["principal"]): Bootstrap => ({
    ...bootstrapFor({ mode: "remote", renderUrl: "https://render.test/__proto/render/" }),
    principal,
  });
  const person = { id: "usr_1", name: "Pedro Nauck", credentialId: null };

  test("dev: the local reviewer comments, deletes and approves (trust); no credentials", () => {
    const dev = permissionsOf(bootstrapFor({ renderUrl: "/r/" }), true);
    expect(dev).toMatchObject({ comment: true, delete: true, approve: true, credentials: false });
  });

  test("remote review session: everything; comment-only session: no delete, no approve", () => {
    const reviewer = permissionsOf(
      remote({ ...person, kind: "reviewer", scopes: ["review", "comment"] }),
      true
    );
    expect(reviewer).toMatchObject({
      comment: true,
      delete: true,
      approve: true,
      credentials: true,
    });
    const commenter = permissionsOf(
      remote({ ...person, kind: "reviewer", scopes: ["comment"] }),
      true
    );
    expect(commenter).toMatchObject({
      comment: true,
      delete: false,
      approve: false,
      credentials: true,
    });
  });

  test("agents never approve, delete or manage credentials; read-only builds write nothing", () => {
    const agent = permissionsOf(
      remote({ ...person, kind: "agent", scopes: ["comment"], credentialId: "cr_1" }),
      true
    );
    expect(agent).toMatchObject({
      comment: true,
      delete: false,
      approve: false,
      credentials: false,
    });
    const readOnly = permissionsOf(bootstrapFor({ mode: "read-only", renderUrl: "/r/" }), false);
    expect(readOnly).toMatchObject({
      comment: false,
      delete: false,
      approve: false,
      credentials: false,
    });
  });
});

describe("Settings → Credentials (remote session)", () => {
  const cleanups: (() => void)[] = [];
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
    vi.unstubAllGlobals();
  });

  function Ready({ children }: { children: ReactNode }) {
    return useShellData().registry.status === "ready" ? children : null;
  }

  test("S17 creates a comment-scope credential, shows its token once and revokes it", async () => {
    const stored: {
      id: string;
      name: string;
      scopes: ["comment"];
      createdAt: string;
      lastUsedAt: null;
    }[] = [];
    const real = globalThis.fetch;
    const network = fakeFetch(async call => {
      const path = new URL(call.url).pathname;
      if (path === "/api/credentials" && call.method === "GET")
        return json({ credentials: stored });
      if (path === "/api/credentials" && call.method === "POST") {
        const credential = {
          id: "cr_9a1",
          name: JSON.parse(call.body ?? "{}").name as string,
          scopes: ["comment"] as ["comment"],
          createdAt: "2026-10-31T00:00:00.000Z",
          lastUsedAt: null,
        };
        stored.push(credential);
        return json({ credential, token: `pcr_${"3b".repeat(32)}` }, 201);
      }
      if (path === "/api/credentials/cr_9a1" && call.method === "DELETE") {
        stored.splice(0);
        return new Response(null, { status: 204 });
      }
      return real(call.url);
    });
    vi.stubGlobal("fetch", network.fetch);
    const bootstrap: Bootstrap = {
      ...bootstrapFor({
        mode: "remote",
        renderUrl: "https://render.test/__proto/render/",
        registryUrl: `data:application/json,${encodeURIComponent(JSON.stringify(registry))}`,
        eventsUrl: null,
      }),
      apiBase: "/api/",
      principal: {
        id: "usr_1",
        name: "Pedro Nauck",
        kind: "reviewer",
        scopes: ["review", "comment"],
        credentialId: null,
      },
    };
    const env: ShellEnv = {
      bootstrap,
      renderUrl: bootstrap.renderUrl,
      renderOrigin: "https://render.test",
    };
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <LocaleProvider locale="en">
          <ShellDataProvider env={env}>
            <Ready>
              <ReviewProvider keys={[]}>
                <Settings section="credentials" />
              </ReviewProvider>
            </Ready>
          </ShellDataProvider>
        </LocaleProvider>
      )
    );
    cleanups.push(() => {
      act(() => root.unmount());
      container.remove();
    });

    await vi.waitFor(() => expect(container.textContent).toContain("No credentials yet."));
    const input = container.querySelector<HTMLInputElement>('input[placeholder^="e.g."]');
    if (!input) throw new Error("No credential name field");
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setValue?.call(input, "codex-ci");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => container.querySelector<HTMLButtonElement>('button[type="submit"]')?.click());
    await vi.waitFor(() => expect(container.textContent).toContain(`pcr_${"3b".repeat(32)}`));
    expect(container.textContent).toContain("“codex-ci” created");
    await vi.waitFor(() => expect(container.textContent).toContain("cr_9a1"));
    expect(JSON.parse(network.calls.find(call => call.method === "POST")?.body ?? "{}")).toEqual({
      name: "codex-ci",
    });

    act(() =>
      container.querySelector<HTMLButtonElement>('button[aria-label="Revoke codex-ci"]')?.click()
    );
    act(() =>
      [...container.querySelectorAll("button")]
        .find(button => button.textContent === "Revoke")
        ?.click()
    );
    await vi.waitFor(() => expect(network.calls.some(call => call.method === "DELETE")).toBe(true));
    await vi.waitFor(() => expect(container.textContent).not.toContain("cr_9a1 ·"));
  });
});

describe("registrySourceRoots (F6)", () => {
  const target = (source: string) => ({
    kind: "element" as const,
    selector: "main",
    testId: null,
    tag: "main",
    text: "",
    source,
    sourceChain: [source],
    rect: { x: 0, y: 0, width: 1, height: 1 },
    rectNormalized: { x: 0, y: 0, width: 1, height: 1 },
    offset: null,
  });

  test("picks are confined to the registry's own roots (custom flows dir and canvas)", () => {
    const custom = {
      ...registry,
      sourceRoots: { dirs: ["src", "journeys"], files: ["preview/canvas.tsx"] },
    };
    expect(
      confinePick(target("journeys/sign-in.flow.ts:3:1"), registrySourceRoots(custom)).ok
    ).toBe(true);
    expect(confinePick(target("preview/canvas.tsx:9:1"), registrySourceRoots(custom)).ok).toBe(
      true
    );
    expect(confinePick(target("../../.github/ci.yml:1:1"), registrySourceRoots(custom)).ok).toBe(
      false
    );
    // Snapshots without roots keep the defaults (src, flows, proto.canvas.tsx).
    expect(
      confinePick(target("journeys/sign-in.flow.ts:3:1"), registrySourceRoots(registry)).ok
    ).toBe(false);
    expect(confinePick(target("flows/sign-in.flow.ts:3:1"), registrySourceRoots(registry)).ok).toBe(
      true
    );
  });
});

describe("SessionWatch (proto-share S1, S4)", () => {
  test("outside a share no check reads the bootstrap and the status stays live", () => {
    // Invariant: ordinary galleries keep today's behavior. Owner: shell session watch.
    const read = vi.fn(async () => "other");
    const watch = new SessionWatch(undefined, read);
    watch.compare();
    watch.failure();
    watch.stale();
    expect(read).not.toHaveBeenCalled();
    expect(watch.status).toBe("live");
  });

  test("checks share one read, compare never ends a session, and statuses only move forward", async () => {
    // Invariant: a refetch only compares (the captured id is never replaced); a failed retry
    // after a failure is S4; S4 outranks S1. Owner: shell session watch.
    let live: string | Error = "snap-a";
    const read = vi.fn(async () => {
      if (live instanceof Error) throw live;
      return live;
    });
    const watch = new SessionWatch("snap-a", read);
    const recovered = vi.fn();
    watch.compare();
    watch.failure(recovered);
    await vi.waitFor(() => expect(recovered).toHaveBeenCalledOnce());
    expect(read).toHaveBeenCalledOnce();
    expect(watch.status).toBe("live");

    live = new TypeError("Failed to fetch");
    watch.compare();
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    await Promise.resolve();
    expect(watch.status).toBe("live");

    live = "snap-b";
    watch.compare();
    await vi.waitFor(() => expect(watch.status).toBe("stale"));
    expect(watch.snapshot).toBe("snap-a");

    live = new TypeError("Failed to fetch");
    watch.failure(recovered);
    await vi.waitFor(() => expect(watch.status).toBe("ended"));
    live = "snap-a";
    watch.compare();
    watch.stale();
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(5));
    expect(watch.status).toBe("ended");
    expect(recovered).toHaveBeenCalledOnce();
  });
});

describe("the shell in a share (proto-share S1, S3, S4, S5)", () => {
  const cleanups: (() => void)[] = [];
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  function Ready({ children }: { children: ReactNode }) {
    return useShellData().registry.status === "ready" ? children : null;
  }

  let session: SessionWatch | null = null;
  /** Hands the mounted shell's session watch to the test, the way a share event would reach it. */
  function Expose() {
    const watch = useShellData().session;
    useEffect(() => {
      session = watch;
    }, [watch]);
    return null;
  }

  function shareEnv(
    overrides: Partial<Bootstrap> = {},
    served: typeof registry = registry
  ): ShellEnv {
    const bootstrap: Bootstrap = {
      ...bootstrapFor({
        mode: "remote",
        renderUrl: "https://render.test/__proto/render/",
        registryUrl: `data:application/json,${encodeURIComponent(JSON.stringify(served))}`,
        eventsUrl: null,
      }),
      apiBase: "/api/",
      snapshot: "snap-a",
      credentials: false,
      principal: {
        id: "ana@acme.com",
        name: "ana@acme.com",
        kind: "reviewer",
        scopes: ["review", "comment"],
        credentialId: null,
      },
      ...overrides,
    };
    return { bootstrap, renderUrl: bootstrap.renderUrl, renderOrigin: "https://render.test" };
  }

  /** The network of a share: `bootstrap.json` and the review API; registry `data:` URLs pass. */
  function shareNetwork(answer: (call: Call, path: string) => Response | Promise<Response>) {
    const real = globalThis.fetch;
    const network = fakeFetch(call =>
      call.url.startsWith("data:") ? real(call.url) : answer(call, new URL(call.url).pathname)
    );
    vi.stubGlobal("fetch", network.fetch);
    return network;
  }

  function mount(env: ShellEnv, children: ReactNode) {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <LocaleProvider locale="en">
          <ShellDataProvider env={env}>
            <Ready>
              <Expose />
              {children}
            </Ready>
          </ShellDataProvider>
        </LocaleProvider>
      )
    );
    cleanups.push(() => {
      act(() => root.unmount());
      container.remove();
      session = null;
    });
    return container;
  }

  const notice = (container: HTMLElement) =>
    container.querySelector<HTMLElement>('[data-testid="session-notice"]');
  const button = (container: HTMLElement, name: string) =>
    [...container.querySelectorAll("button")].find(item => item.textContent?.trim() === name);
  const reviewOf = (open: number) =>
    json({ review: { key: "login-form", status: "in_review", updatedAt: null, open, events: [] } });

  test("US-009.AC-2: approval sends the loaded id; snapshot_stale shows S1 with the dialog closed", async () => {
    // Invariant: an approval asserts the version on screen, and a refused one explains itself
    // without leaving the confirmation open. Owner: approval control + SessionNotice.
    const env = shareEnv();
    const network = shareNetwork((call, path) => {
      if (path === "/api/reviews/login-form/transitions")
        return json({ error: { code: "snapshot_stale", message: "A new version is live." } }, 409);
      if (path === "/api/reviews/login-form") return reviewOf(1);
      return json({ comments: [] });
    });
    const container = mount(
      env,
      <ReviewProvider keys={["login-form"]}>
        <SessionNotice />
        <ReviewActions reviewKey="login-form" title="Sign in" />
      </ReviewProvider>
    );
    await vi.waitFor(() => expect(button(container, "Approve")).toBeDefined());
    expect(notice(container)).toBeNull();
    act(() => button(container, "Approve")?.click());
    await vi.waitFor(() => expect(document.body.textContent).toContain("Approve anyway"));
    act(() => button(document.body, "Approve anyway")?.click());
    await vi.waitFor(() => expect(notice(container)?.dataset.status).toBe("stale"));
    expect(notice(container)?.textContent).toContain("A new version is available.");
    expect(document.body.textContent).not.toContain("Approve anyway");
    const post = network.calls.find(call => call.method === "POST");
    expect(JSON.parse(post?.body ?? "{}")).toEqual({
      to: "approved",
      confirmOpen: true,
      snapshot: "snap-a",
    });
    expect(network.calls.some(call => call.url.endsWith("/__proto/bootstrap.json"))).toBe(false);
  });

  test("S1: a comparison with the same id stays hidden; a new id shows the notice; a draft confirms", async () => {
    // Invariant: S1 appears only for a different live id, and Reload with an unsent comment asks
    // first. Owner: shell session watch + SessionNotice.
    const env = shareEnv();
    let live = "snap-a";
    const network = shareNetwork((_call, path) =>
      path.endsWith("/__proto/bootstrap.json")
        ? json({ ...env.bootstrap, snapshot: live })
        : json({ comments: [] })
    );
    window.localStorage.setItem("proto:draft:new:login-form", "Half-written note");
    const container = mount(env, <SessionNotice />);
    await vi.waitFor(() => expect(session).not.toBeNull());
    const bootstraps = () =>
      network.calls.filter(call => call.url.endsWith("/__proto/bootstrap.json")).length;
    act(() => session!.compare());
    await vi.waitFor(() => expect(bootstraps()).toBe(1));
    await act(async () => {});
    expect(notice(container)).toBeNull();

    live = "snap-b";
    act(() => session!.compare());
    await vi.waitFor(() => expect(notice(container)?.dataset.status).toBe("stale"));
    expect(session!.snapshot).toBe("snap-a");
    act(() => button(container, "Reload")?.click());
    expect(notice(container)?.textContent).toContain("You have an unsent comment. Reload anyway?");
    expect(button(container, "Reload anyway")).toBeDefined();
    act(() => button(container, "Cancel")?.click());
    expect(button(container, "Reload anyway")).toBeUndefined();
    expect(button(container, "Reload")).toBeDefined();
  });

  test("S4: an API network failure retries the bootstrap; only a failed retry ends the session", async () => {
    // Invariant: a passing failure keeps today's behavior; a failed retry shows S4, warning
    // that the unsent draft will be lost. Owner: review client + shell session watch.
    let bootstrapUp = true;
    const env = shareEnv();
    const network = shareNetwork((_call, path) => {
      if (path.endsWith("/__proto/bootstrap.json")) {
        if (!bootstrapUp) throw new TypeError("Failed to fetch");
        return json(env.bootstrap);
      }
      throw new TypeError("Failed to fetch");
    });
    const bootstraps = () =>
      network.calls.filter(call => call.url.endsWith("/__proto/bootstrap.json")).length;
    const passing = mount(
      env,
      <ReviewProvider keys={["login-form"]}>
        <SessionNotice />
        <ReviewActions reviewKey="login-form" title="Sign in" />
      </ReviewProvider>
    );
    await vi.waitFor(() => expect(bootstraps()).toBeGreaterThan(0));
    await act(async () => {});
    expect(notice(passing)).toBeNull();
    for (const cleanup of cleanups.splice(0)) cleanup();

    bootstrapUp = false;
    window.localStorage.setItem("proto:draft:reply:login-form-1", "Unsent reply");
    const ended = mount(
      env,
      <ReviewProvider keys={["login-form"]}>
        <SessionNotice />
        <ReviewActions reviewKey="login-form" title="Sign in" />
      </ReviewProvider>
    );
    await vi.waitFor(() => expect(notice(ended)?.dataset.status).toBe("ended"));
    expect(notice(ended)?.getAttribute("role")).toBe("alert");
    expect(notice(ended)?.textContent).toContain("This session ended.");
    expect(notice(ended)?.textContent).toContain("Your unsent comment will be lost.");
  });

  test("S4: a stream that keeps failing to reconnect retries the bootstrap; a passing blip does not", async () => {
    // Invariant (ASTRA-004, US-007.EC-3): with no API call, a bounded run of reconnect errors
    // without an `open` is a session check, and S4 follows when the bootstrap also fails; a blip
    // that reopens and any failure outside a share keep today's behavior. Owner: shell events +
    // session watch.
    class FakeSource extends EventTarget {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSED = 2;
      static all: FakeSource[] = [];
      readyState = FakeSource.CONNECTING;
      constructor(readonly url: string | URL) {
        super();
        FakeSource.all.push(this);
      }
      close() {
        this.readyState = FakeSource.CLOSED;
      }
      /** The browser lost the connection and stays in CONNECTING to retry. */
      fail() {
        this.readyState = FakeSource.CONNECTING;
        this.dispatchEvent(new Event("error"));
      }
      open() {
        this.readyState = FakeSource.OPEN;
        this.dispatchEvent(new Event("open"));
      }
    }
    vi.stubGlobal("EventSource", FakeSource);
    let bootstrapUp = true;
    const env = shareEnv({ eventsUrl: "/__proto/events" });
    const network = shareNetwork((_call, path) => {
      if (!path.endsWith("/__proto/bootstrap.json")) return json({ comments: [] });
      if (!bootstrapUp) throw new TypeError("Failed to fetch");
      return json(env.bootstrap);
    });
    const bootstraps = () =>
      network.calls.filter(call => call.url.endsWith("/__proto/bootstrap.json")).length;

    const gallery = mount(shareEnv({ snapshot: undefined, eventsUrl: "/__proto/events" }), null);
    await vi.waitFor(() => expect(FakeSource.all).toHaveLength(1));
    act(() => {
      for (let index = 0; index < 6; index++) FakeSource.all[0]!.fail();
    });
    await act(async () => {});
    expect(bootstraps()).toBe(0);
    expect(notice(gallery)).toBeNull();
    for (const cleanup of cleanups.splice(0)) cleanup();

    const container = mount(env, <SessionNotice />);
    await vi.waitFor(() => expect(FakeSource.all).toHaveLength(2));
    const source = FakeSource.all[1]!;
    act(() => {
      source.fail();
      source.fail();
      source.open();
    });
    // The reopen after a gap compares versions once; the blip itself is no failure.
    await vi.waitFor(() => expect(bootstraps()).toBe(1));
    act(() => {
      source.fail();
      source.fail();
    });
    await act(async () => {});
    expect(bootstraps()).toBe(1);
    act(() => source.fail());
    await vi.waitFor(() => expect(bootstraps()).toBe(2));
    await act(async () => {});
    expect(notice(container)).toBeNull();

    bootstrapUp = false;
    act(() => {
      for (let index = 0; index < 3; index++) source.fail();
    });
    await vi.waitFor(() => expect(notice(container)?.dataset.status).toBe("ended"));
    expect(bootstraps()).toBe(3);
    expect(FakeSource.all).toHaveLength(2);
  });

  test("S1, S4: a draft that storage refused still confirms Reload and is warned about", async () => {
    // Invariant (ASTRA-006): draft presence follows the mounted composer's in-memory text, not
    // only localStorage, so a refused write keeps the S1 confirmation and the S4 warning.
    // Owner: drafts + SessionNotice.
    const refuse = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    cleanups.push(() => refuse.mockRestore());
    function Composer() {
      const [body, setBody] = useDraft("new:login-form");
      return (
        <button type="button" data-body={body} onClick={() => setBody("Half-written note")}>
          Type
        </button>
      );
    }
    let live: string | Error = "snap-b";
    const env = shareEnv();
    shareNetwork((_call, path) => {
      if (!path.endsWith("/__proto/bootstrap.json")) return json({ comments: [] });
      if (live instanceof Error) throw live;
      return json({ ...env.bootstrap, snapshot: live });
    });
    const container = mount(
      env,
      <>
        <SessionNotice />
        <Composer />
      </>
    );
    await vi.waitFor(() => expect(session).not.toBeNull());
    act(() => session!.compare());
    await vi.waitFor(() => expect(notice(container)?.dataset.status).toBe("stale"));
    act(() => button(container, "Type")?.click());
    expect(button(container, "Type")?.dataset.body).toBe("Half-written note");
    expect(window.localStorage.getItem("proto:draft:new:login-form")).toBeNull();
    act(() => button(container, "Reload")?.click());
    expect(notice(container)?.textContent).toContain("You have an unsent comment. Reload anyway?");
    expect(button(container, "Reload anyway")).toBeDefined();

    live = new TypeError("Failed to fetch");
    act(() => session!.failure());
    await vi.waitFor(() => expect(notice(container)?.dataset.status).toBe("ended"));
    expect(notice(container)?.textContent).toContain("Your unsent comment will be lost.");
  });

  test("S5: Settings has no Credentials section when the bootstrap disables credentials", async () => {
    // Invariant: bootstrap `credentials: false` removes the section, not just its actions.
    // Owner: permissions + Settings.
    const env = shareEnv();
    expect(permissionsOf(env.bootstrap, true).credentials).toBe(false);
    expect(permissionsOf({ ...env.bootstrap, credentials: undefined }, true).credentials).toBe(
      true
    );
    shareNetwork(() => json({ comments: [] }));
    const container = mount(
      env,
      <ReviewProvider keys={[]}>
        <Settings section="credentials" />
      </ReviewProvider>
    );
    await vi.waitFor(() =>
      expect(container.querySelector('a[href*="settings=project"]')).not.toBeNull()
    );
    expect(container.querySelector('a[href*="settings=credentials"]')).toBeNull();
    expect(container.textContent).not.toContain("No credentials yet.");
  });

  test("S3: a share of one prototype offers no empty Flows or Drafts areas; a gallery keeps them", async () => {
    // Invariant: the scoped registry drives navigation; areas it leaves empty are absent.
    // Owner: shell rail.
    const one = {
      ...registry,
      prototypes: registry.prototypes.filter(item => item.slug === "login-form"),
      flows: [],
    };
    shareNetwork(() => json({ comments: [] }));
    const view = {
      area: "screen",
      slug: "login-form",
      state: null,
      width: "fit",
      role: null,
      compare: false,
      comment: null,
    } as const;
    const labels = (container: HTMLElement) =>
      [...container.querySelectorAll("nav a")].map(link => link.getAttribute("aria-label"));
    const shared = mount(shareEnv({}, one), <ShellRail view={view} />);
    await vi.waitFor(() => expect(labels(shared)).toContain("Screens"));
    expect(labels(shared)).not.toContain("Flows");
    expect(labels(shared)).not.toContain("Drafts");
    const gallery = mount(shareEnv({ snapshot: undefined }, one), <ShellRail view={view} />);
    await vi.waitFor(() => expect(labels(gallery)).toContain("Screens"));
    expect(labels(gallery)).toEqual(expect.arrayContaining(["Flows", "Drafts"]));
  });
});
