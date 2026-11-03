import { createRequire } from "node:module";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const sourceApp = resolve(import.meta.dirname, "../../../../apps/app");
const fixtureBase = resolve(sourceApp, "../../.tmp");
export const appFiles = [
  "package.json",
  "proto.config.ts",
  "proto.canvas.tsx",
  "vite.config.ts",
  "vite.shared.ts",
  "index.html",
  "src",
  "flows",
];

/** App copies live outside every app root; dependency links never share mutable cache dirs. */
export function appFixture(prefix: string, files: readonly string[] = []) {
  mkdirSync(fixtureBase, { recursive: true });
  const root = mkdtempSync(join(fixtureBase, prefix));
  mkdirSync(join(root, "node_modules"));
  for (const name of readdirSync(join(sourceApp, "node_modules"))) {
    if (name.startsWith(".") && name !== ".bin") continue;
    symlinkSync(join(sourceApp, "node_modules", name), join(root, "node_modules", name), "dir");
  }
  writeFileSync(join(root, "package.json"), JSON.stringify({ private: true, type: "module" }));
  for (const file of files) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    cpSync(join(sourceApp, file), join(root, file), { recursive: true });
  }
  return root;
}

/** Two real Vite projects with separate package dependency links and private optimizer caches. */
export function storiesFixture() {
  const root = mkdtempSync(join(fixtureBase, "proto-stories-"));
  const fixture = resolve(import.meta.dirname, "../fixtures/stories");
  cpSync(fixture, root, { recursive: true });
  const dependencies = resolve(import.meta.dirname, "../../node_modules");
  for (const folder of ["app", "packages/ui"]) {
    const target = join(root, folder, "node_modules");
    mkdirSync(target, { recursive: true });
    for (const name of readdirSync(dependencies)) {
      if (name.startsWith(".") && name !== ".bin") continue;
      symlinkSync(join(dependencies, name), join(target, name), "dir");
    }
  }
  const require = createRequire(resolve(import.meta.dirname, "../../package.json"));
  mkdirSync(join(root, "app/public"), { recursive: true });
  cpSync(
    join(dirname(require.resolve("msw/package.json")), "lib/mockServiceWorker.js"),
    join(root, "app/public/mockServiceWorker.js")
  );
  return { root, app: join(root, "app") };
}
