/**
 * Registry and environment of the comment-mode suite: the shell harness registry (flows, roles)
 * plus the render harness prototypes `card` and `forge` that the cross-origin render host serves
 * (`test/browser/render/harness/prototypes.tsx`).
 */
import type { Registry, RegistryPrototype } from "../../../src/model/registry.ts";
import type { ShellEnv } from "../../../src/shell/lib/shell-data.tsx";
import { bootstrapFor, registry as shellRegistry } from "../../harness/fixtures.ts";

export const renderOrigin = window.location.origin.replace("127.0.0.1", "localhost");
const renderUrl = `${renderOrigin}/test/browser/render/__proto/render/index.html`;

const states: RegistryPrototype["states"] = [
  { id: "default", label: "Default" },
  { id: "b", label: "B" },
];

const card: RegistryPrototype = {
  slug: "card",
  kind: "component",
  file: "src/components/card.proto.tsx",
  title: "Card",
  spec: null,
  surface: null,
  route: "/cards",
  blocks: [],
  roles: ["admin", "member"],
  standalone: false,
  states,
};

export const registry: Registry = {
  ...shellRegistry,
  roles: { admin: "Admin", member: "Member" },
  prototypes: [
    ...shellRegistry.prototypes,
    card,
    {
      ...card,
      slug: "forge",
      kind: "draft",
      title: "Forge",
      file: "src/drafts/forge/index.proto.tsx",
    },
  ],
};

export const slugs = new Set(registry.prototypes.map(item => item.slug));

export const env: ShellEnv = {
  bootstrap: bootstrapFor({
    renderUrl,
    eventsUrl: null,
    registryUrl: `data:application/json,${encodeURIComponent(JSON.stringify(registry))}`,
  }),
  renderUrl,
  renderOrigin,
};
