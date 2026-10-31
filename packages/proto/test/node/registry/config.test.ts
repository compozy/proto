import { describe, expect, it } from "vitest";
import { defineProtoConfig, resolveProtoConfig } from "../../../src/config.ts";
import { ProtoError } from "../../../src/model/errors.ts";

describe("UT-097 config lifecycle", () => {
  it("evaluates the catalog with the app root and preserves unavailable catalogs", () => {
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
