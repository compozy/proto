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
  matcher: string | RegExp = "src/lib/gateway-test.ts"
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
it("UT-081 ordinary application graphs can reach data", async () => {
  await expect(compile("src/main.ts", 'export { value } from "./view.ts";')).resolves.toBeDefined();
});
it("UT-081 RegExp matchers guard stories", async () => {
  await expect(
    compile("src/test.stories.ts", 'export { value } from "./view.ts";', false, /gateway-test/)
  ).rejects.toThrow(/network_import/);
});
it("UT-061 production boundary rejects prototype modules", async () => {
  await expect(compile("src/test.proto.ts", "export const value=1;", true)).rejects.toThrow(
    /production_boundary/
  );
});
// Production graph ownership: published package ids and configured directories are forbidden.
it("UT-061 installed package and custom project paths cannot enter production", async () => {
  const { loadProject } = await import("../../../src/node/project.ts");
  const root = mkdtempSync(join(tmpdir(), "proto-boundary-"));
  try {
    writeFileSync(
      join(root, "proto.config.ts"),
      'export default {title:"Test",flows:"journeys",drafts:"experiments",canvas:"custom.canvas.tsx"};'
    );
    const project = await loadProject(root);
    for (const id of [
      "/consumer/node_modules/@compozy/proto/dist/contract.js",
      "/consumer/node_modules/.pnpm/@compozy+proto@0.1.0/node_modules/@compozy/proto/dist/contract.js",
      ...[
        "journeys/index.ts",
        "experiments/view.ts",
        "preview/index.ts",
        ".storybook/config.ts",
        "custom.canvas.tsx",
      ].map(path => join(root, path)),
    ]) {
      await expect(
        build({
          root,
          configFile: false,
          logLevel: "silent",
          plugins: [
            {
              name: "virtual-package-io",
              resolveId: input => (input === "entry" ? id : null),
              load: input => (input === id ? "export const value=1" : null),
            },
            productionBoundary(project),
          ],
          build: { write: false, rollupOptions: { input: "entry" } },
        })
      ).rejects.toThrow(/production_boundary/);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
it("Source transform: tags preserve authored coordinates", () => {
  expect(tagJsx("export const View = () => (\n  <div />\n);", "src/view.tsx")).toContain(
    'data-proto-src="src/view.tsx:2:3"'
  );
});

it("UT-062 productionBoundary false disables the application guard", async () => {
  const { proto } = await import("../../../src/vite/index.ts");
  const root = mkdtempSync(join(tmpdir(), "proto-disabled-"));
  try {
    writeFileSync(join(root, "package.json"), '{"type":"module"}');
    writeFileSync(
      join(root, "proto.config.ts"),
      'export default {title:"Test",guards:{productionBoundary:false}};'
    );
    writeFileSync(join(root, "leak.proto.ts"), "export const value=1;");
    await expect(
      build({
        root,
        configFile: false,
        logLevel: "silent",
        plugins: proto(),
        build: { write: false, rollupOptions: { input: join(root, "leak.proto.ts") } },
      })
    ).resolves.toBeDefined();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
it("IT-017 app copy rejects a prototype leak and allows route data imports", async () => {
  const { cpSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const app = resolve(import.meta.dirname, "../../../../../apps/app");
  const root = mkdtempSync(join(app, ".proto-build-test-"));
  try {
    for (const file of ["vite.config.ts", "vite.shared.ts", "proto.config.ts", "index.html", "src"])
      cpSync(join(app, file), join(root, file), { recursive: true });
    writeFileSync(join(root, "src/leak.proto.ts"), "export const leak=1;");
    writeFileSync(
      join(root, "src/probe.ts"),
      'import { leak } from "./leak.proto.ts"; console.log(leak);'
    );
    const config = {
      root,
      logLevel: "silent" as const,
      build: { write: false, rollupOptions: { input: join(root, "src/probe.ts") } },
    };
    await expect(build(config)).rejects.toThrow(/production_boundary/);
    writeFileSync(
      join(root, "src/probe.ts"),
      'import * as api from "./lib/api.ts"; console.log(api);'
    );
    await expect(build(config)).resolves.toBeDefined();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
it.each([
  [/^@tanstack\/react-query$/, "@tanstack/react-query"],
  ["better-auth", "better-auth/client"],
] as const)(
  "UT-081 protoPresentation matches package specifiers with %s",
  async (matcher, specifier) => {
    const { protoPresentation } = await import("../../../src/vite/index.ts");
    const root = mkdtempSync(join(tmpdir(), "proto-matcher-"));
    try {
      writeFileSync(join(root, "package.json"), '{"type":"module"}');
      writeFileSync(
        join(root, "proto.config.ts"),
        `export default {title:"Matchers",guards:{forbidRuntimeImports:[${matcher instanceof RegExp ? matcher.toString() : JSON.stringify(matcher)}]}};`
      );
      writeFileSync(
        join(root, "test.proto.ts"),
        `import { value } from ${JSON.stringify(specifier)}; console.log(value);`
      );
      await expect(
        build({
          root,
          configFile: false,
          logLevel: "silent",
          plugins: protoPresentation(),
          build: {
            write: false,
            rollupOptions: { input: join(root, "test.proto.ts"), external: [specifier] },
          },
        })
      ).rejects.toThrow(/network_import/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
);

it("UT-081 globs match runtime modules", async () => {
  await expect(
    compile("src/test.proto.tsx", 'export {value} from "./view.ts";', false, "src/lib/gateway-*.ts")
  ).rejects.toThrow(/network_import/);
});
it.each([
  ["Storybook build", ["storybook", "build", "--quiet", "--disable-telemetry"]],
  ["app Vitest", ["vitest", "run", "--project=storybook-light", "src/guard-probe.stories.tsx"]],
] as const)(
  "IT-030 %s rejects story runtime data imports",
  async (_context, args) => {
    const { cpSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const run = promisify(execFile);
    const app = resolve(import.meta.dirname, "../../../../../apps/app");
    const root = mkdtempSync(join(app, ".proto-story-guard-"));
    try {
      for (const file of [
        ".storybook",
        "vite.shared.ts",
        "vitest.config.ts",
        "proto.config.ts",
        "proto.canvas.tsx",
        "src",
      ])
        cpSync(join(app, file), join(root, file), { recursive: true });
      const { readFileSync } = await import("node:fs");
      const shared = join(root, "vite.shared.ts");
      writeFileSync(
        shared,
        readFileSync(shared, "utf8").replace(
          "export default defineConfig({",
          `export default defineConfig({cacheDir:${JSON.stringify(join(root, ".vite-cache"))},`
        )
      );
      const main = join(root, ".storybook/main.ts");
      writeFileSync(
        main,
        readFileSync(main, "utf8").replace(
          'stories: ["../src/**/*.stories.tsx", "../../../packages/ui/src/**/*.stories.tsx"]',
          'stories: ["../src/guard-probe.stories.tsx"]'
        )
      );
      writeFileSync(
        join(root, "src/guard-probe.stories.tsx"),
        'import { api } from "./lib/api"; export default {title:"Guard probe",render:()=> <div>{String(Boolean(api))}</div>};export const Runtime={};'
      );
      const result = await run("bunx", [...args], {
        cwd: root,
        env: {
          ...Object.fromEntries(
            Object.entries(process.env).filter(
              ([key]) => !key.startsWith("VITEST") && key !== "NODE_ENV"
            )
          ),
          STORYBOOK_DISABLE_TELEMETRY: "1",
          CI: "1",
        },
        timeout: 50000,
        maxBuffer: 4 * 1024 * 1024,
      }).then(
        output => ({ code: 0, output: output.stdout + output.stderr }),
        error => ({ code: error.code, output: String(error.stdout) + String(error.stderr) })
      );
      expect(result.code).toBe(1);
      expect(result.output).toContain("network_import:");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
  60000
);
