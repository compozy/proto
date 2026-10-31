/**
 * The shell's review client and the review controls it renders: the client's request contract
 * (cookie writes carry `X-Proto-Request`, a 401 `auth_required` reaches the session-expired
 * handler, failures keep their registry code), the UI restatement of the authorization matrix,
 * and the remote Credentials section (S17: created token shown once, revoke). The network is
 * the faked I/O boundary; everything above it is the real shell code.
 */
import "../../../src/shell/theme.css";

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { Bootstrap } from "../../../src/model/bootstrap.ts";
import { LocaleProvider } from "../../../src/shell/lib/i18n.tsx";
import {
  ShellDataProvider,
  useShellData,
  type ShellEnv,
} from "../../../src/shell/lib/shell-data.tsx";
import { createReviewApi, isReviewApiError } from "../../../src/shell/review/api.ts";
import { ReviewProvider } from "../../../src/shell/review/data.tsx";
import { permissionsOf } from "../../../src/shell/review/permissions.ts";
import { confinePick } from "../../../src/shell/review/comment-mode/pick.ts";
import { registrySourceRoots } from "../../../src/shell/lib/registry-model.ts";
import { Settings } from "../../../src/shell/review/settings/settings.tsx";
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
