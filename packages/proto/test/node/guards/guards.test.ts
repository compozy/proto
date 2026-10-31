import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "vite";
import { expect, it } from "vitest";
import { presentationGuard } from "../../../src/node/presentation-guard.ts";
import { productionBoundary } from "../../../src/node/production-boundary.ts";
import { tagJsx } from "../../../src/node/source-tags.ts";
async function compile(
  entry: string,
  source: string,
  boundary = false,
  matcher: string | RegExp = "src/lib/gateway-*.ts"
) {
  const root = mkdtempSync(join(tmpdir(), "proto-guard-"));
  try {
    mkdirSync(join(root, "src/lib"), { recursive: true });
    writeFileSync(join(root, entry), source);
    writeFileSync(join(root, "src/view.ts"), 'export { value } from "./lib/gateway-test.ts";');
    writeFileSync(
      join(root, "src/lib/gateway-test.ts"),
      "export const value = 1; export type Value = number;"
    );
    return await build({
      root,
      configFile: false,
      logLevel: "silent",
      plugins: [
        boundary
          ? productionBoundary()
          : presentationGuard(root, { modules: [], packages: [], matchers: [matcher] }),
      ],
      build: { write: false, rollupOptions: { input: join(root, entry) } },
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
it("UT-059 transitive runtime network imports report chain", async () => {
  await expect(compile("src/test.proto.ts", 'export { value } from "./view.ts";')).rejects.toThrow(
    /network_import:.*view.ts.*gateway-test.ts/
  );
});
it("UT-060 type-only imports are ignored", async () => {
  await expect(
    compile(
      "src/test.proto.ts",
      'import type { Value } from "./lib/gateway-test.ts"; export const value:Value=1;'
    )
  ).resolves.toBeDefined();
});
it("UT-061 ordinary application graphs can reach data", async () => {
  await expect(compile("src/main.ts", 'export { value } from "./view.ts";')).resolves.toBeDefined();
});
it("UT-062 RegExp matchers guard stories", async () => {
  await expect(
    compile("src/test.stories.ts", 'export { value } from "./view.ts";', false, /gateway-test/)
  ).rejects.toThrow(/network_import/);
});
it("UT-081 production boundary rejects prototype modules", async () => {
  await expect(compile("src/test.proto.ts", "export const value=1;", true)).rejects.toThrow(
    /production_boundary/
  );
});
it("IT-030 source tags preserve authored coordinates", () => {
  expect(tagJsx("export const View = () => (\n  <div />\n);", "src/view.tsx")).toContain(
    'data-proto-src="src/view.tsx:2:3"'
  );
});
