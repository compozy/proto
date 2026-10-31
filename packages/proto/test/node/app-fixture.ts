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
