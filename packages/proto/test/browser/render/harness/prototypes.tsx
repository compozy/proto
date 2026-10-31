/**
 * `virtual:proto/prototypes` of the protocol suite. `card` lays out fixed boxes so the suite can
 * aim at render viewport coordinates; its `data-proto-src` values include forged paths the host
 * must drop before posting.
 */
import type { PrototypeProps } from "../../../../src/contract.ts";
import type { RenderPrototype } from "../../../../src/model/render-host.ts";
import { setParam } from "../../../../src/render/url-state.ts";

const longText = "A very long description ".repeat(10);

/** Ten nested sources: more than a pick may carry. */
function Nested({ depth }: { depth: number }) {
  if (depth === 0) return <span data-testid="deepest">deep</span>;
  return (
    <span data-proto-src={`src/deep.tsx:${depth}:1`} style={{ display: "block", height: "100%" }}>
      <Nested depth={depth - 1} />
    </span>
  );
}

function Card({ state, role }: PrototypeProps) {
  return (
    <main
      data-testid="card"
      data-state={state}
      data-role={role ?? ""}
      data-proto-src="/etc/passwd:1:1"
      style={{ position: "relative", height: 2000, font: "14px sans-serif" }}
    >
      <section data-proto-src="src/components/card.tsx:3:5">
        <button
          type="button"
          data-testid="save"
          data-proto-src="../../.github/workflows/ci.yml:1:1"
          style={{ position: "absolute", left: 40, top: 40, width: 120, height: 32 }}
        >
          <span data-proto-src="src/components/card.tsx:9:9">Save changes</span>
        </button>
        <p
          data-testid="long"
          data-proto-src="src/components/card.tsx:12:7"
          style={{
            position: "absolute",
            left: 200,
            top: 40,
            width: 180,
            height: 40,
            margin: 0,
            overflow: "hidden",
          }}
        >
          {longText}
        </p>
        <div
          data-testid="panel"
          data-proto-src="src/components/panel.tsx:2:3"
          style={{
            position: "absolute",
            left: 40,
            top: 120,
            width: "50%",
            height: 200,
            background: "#eee",
          }}
        >
          <span data-proto-src="src/components/panel.tsx:4:5">Panel title</span>
        </div>
        <div
          data-testid="deep"
          style={{ position: "absolute", left: 400, top: 120, width: 120, height: 60 }}
        >
          <Nested depth={10} />
        </div>
        <button
          type="button"
          data-testid="tab"
          onClick={() => setParam("tab", "2")}
          style={{ position: "absolute", left: 40, top: 360, width: 80, height: 32 }}
        >
          Tab 2
        </button>
        <button
          type="button"
          data-testid="later"
          onClick={() => setTimeout(() => setParam("state", "b"), 300)}
          style={{ position: "absolute", left: 140, top: 360, width: 80, height: 32 }}
        >
          Later
        </button>
        {state === "b" ? (
          <p data-testid="state-b" style={{ position: "absolute", left: 40, top: 420, margin: 0 }}>
            State B
          </p>
        ) : null}
        <div
          data-testid="far"
          style={{ position: "absolute", left: 40, top: 1500, width: 100, height: 40 }}
        >
          Far
        </div>
      </section>
    </main>
  );
}

/**
 * A hostile prototype: it shares the render host's realm, so it can read the frame nonce and
 * post any render → shell message (`_spec.md` § Shell ⇄ render protocol, E2E-014).
 */
function Forge() {
  const forge = (source: string, delay: number) =>
    setTimeout(() => {
      const frame = new URLSearchParams(window.location.search).get("frame");
      const rect = { x: 40, y: 40, width: 120, height: 32 };
      window.parent.postMessage(
        {
          proto: 1,
          frame,
          type: "pick:result",
          target: {
            kind: "element",
            selector: '[data-testid="forge-now"]',
            testId: "forge-now",
            tag: "button",
            text: "Forged",
            source,
            sourceChain: [source],
            rect,
            rectNormalized: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 },
            offset: null,
          },
        },
        "*"
      );
    }, delay);
  const button = (left: number) => ({
    position: "absolute" as const,
    left,
    top: 40,
    width: 120,
    height: 32,
  });
  return (
    <main style={{ position: "relative", height: 400 }}>
      <button
        type="button"
        data-testid="forge-now"
        style={button(40)}
        onClick={() => forge("src/forged.tsx:1:1", 0)}
      >
        Forge now
      </button>
      <button
        type="button"
        data-testid="forge-later"
        style={button(200)}
        onClick={() => forge("../../.github/workflows/ci.yml:1:1", 1500)}
      >
        Forge later
      </button>
    </main>
  );
}

function Plain({ state }: PrototypeProps) {
  return <p data-testid="plain">{state}</p>;
}

function Broken(): never {
  throw new Error("Broken on purpose");
}

const states = [
  { id: "default", label: "Default" },
  { id: "b", label: "B" },
] as [{ id: string; label: string }, ...{ id: string; label: string }[]];

const base = { route: "/cards", standalone: false, roles: [], states };

export const prototypes: RenderPrototype[] = [
  {
    ...base,
    slug: "card",
    kind: "component",
    title: "Card",
    roles: ["admin", "member"],
    load: async () => ({ default: Card }),
  },
  {
    ...base,
    slug: "standalone-card",
    kind: "component",
    title: "Standalone",
    standalone: true,
    load: async () => ({ default: Plain }),
  },
  {
    ...base,
    slug: "welcome",
    kind: "draft",
    title: "Welcome",
    route: null,
    load: async () => ({ default: Plain }),
  },
  {
    ...base,
    slug: "forge",
    kind: "draft",
    title: "Forge",
    route: null,
    load: async () => ({ default: Forge }),
  },
  {
    ...base,
    slug: "broken",
    kind: "component",
    title: "Broken",
    load: async () => ({ default: Broken }),
  },
  {
    ...base,
    slug: "missing",
    kind: "component",
    title: "Missing",
    load: () => Promise.reject(new Error("Chunk failed")),
  },
];
