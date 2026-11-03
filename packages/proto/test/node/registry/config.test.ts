import { describe, expect, it } from "vitest";
import { defineProtoConfig, resolveProtoConfig } from "../../../src/config.ts";
import { ProtoError } from "../../../src/model/errors.ts";

describe("config lifecycle", () => {
  it("UT-097 evaluates the catalog with the app root and preserves unavailable catalogs", () => {
    const config = defineProtoConfig({
      title: "Example",
      specs: (root: string) => ({ project_spec: root }),
    });
    expect(resolveProtoConfig(config, "/app", {}).specs).toEqual({ project_spec: "/app" });
    expect(
      resolveProtoConfig({ title: "Example", specs: () => null }, "/app", {}).specs
    ).toBeNull();
  });
  it("resolves defaults and environment overrides", () => {
    const defaults = resolveProtoConfig({ title: "Example" }, "/app", {});
    expect(defaults.dev).toEqual({ port: 4400, poll: false, allowedHosts: [] });
    expect(defaults.build.includeReview).toBe(false);
    expect(defaults.evidence.dir).toBe("docs/design");
    expect(
      resolveProtoConfig({ title: "Example", dev: { port: 5000 } }, "/app", {
        PROTO_PORT: "6000",
        PROTO_POLL: "1",
      }).dev
    ).toEqual({ port: 6000, poll: true, allowedHosts: [] });
  });
  it("reports invalid key paths using the shared error code", () => {
    expect(() =>
      resolveProtoConfig({ title: "Example", dev: { port: 65535 } }, "/app", {})
    ).toThrow(/dev.port/);
    expect(() => resolveProtoConfig({ title: "Example" }, "/app", { PROTO_PORT: "bad" })).toThrow(
      ProtoError
    );
    expect(() =>
      resolveProtoConfig({ title: "Example", specs: { "bad id": "Invalid" } }, "/app", {})
    ).toThrow(/specs/);
  });
});

// Invariant: story roots and every actual port fit their declared scope. Owner: config resolver.
describe("story configuration", () => {
  const root = {
    id: "ui",
    stories: "src/**/*.stories.tsx",
    preview: "preview.ts",
    vite: "vite.config.ts",
  };
  it("accepts an external root and keeps the root defaults", () => {
    const config = resolveProtoConfig(
      { title: "Stories", stories: { roots: [{ ...root, dir: "../../ui" }] } },
      "/app",
      {}
    );
    expect(config.stories?.roots[0]).toMatchObject({ dir: "../../ui", themeGlobal: "theme" });
  });
  it.each([
    "../*.stories.tsx",
    "/tmp/*.stories.tsx",
    "src/../../*.stories.tsx",
    "{src,../other}/*.stories.tsx",
    "C:\\stories\\*.tsx",
  ])("rejects escaping glob %s", stories => {
    expect(() =>
      resolveProtoConfig(
        { title: "Stories", stories: { roots: [{ ...root, stories }] } },
        "/app",
        {}
      )
    ).toThrow(ProtoError);
  });
  it("rejects duplicate roots and missing required paths", () => {
    expect(() =>
      resolveProtoConfig({ title: "Stories", stories: { roots: [root, root] } }, "/app", {})
    ).toThrow(/Duplicate root/);
    expect(() =>
      resolveProtoConfig(
        { title: "Stories", stories: { roots: [{ ...root, preview: "" }] } },
        "/app",
        {}
      )
    ).toThrow(/preview/);
  });
  it("uses the same port-range validation for config and CLI overrides", async () => {
    const { validatePortRange } = await import("../../../src/config.ts");
    expect(validatePortRange(65533, 1)).toBe(65533);
    expect(() => validatePortRange(65534, 1)).toThrow(ProtoError);
    expect(() =>
      resolveProtoConfig({ title: "Stories", stories: { roots: [root] } }, "/app", {
        PROTO_PORT: "65534",
      })
    ).toThrow(ProtoError);
  });
});
