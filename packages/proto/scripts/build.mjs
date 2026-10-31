import { readFile, writeFile, cp, chmod, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { checkSize } from "./check-size.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const stage = new URL("../dist/package/", import.meta.url);
await rm(stage, { recursive: true, force: true });
execFileSync("bun", ["x", "--no-install", "tsdown"], { cwd: root, stdio: "inherit" });
await mkdir(stage, { recursive: true });
for (const folder of ["render", "model"])
  await cp(new URL(`../src/${folder}/`, import.meta.url), new URL(`src/${folder}/`, stage), {
    recursive: true,
  });
if (existsSync(new URL("../src/server/migrations/", import.meta.url)))
  await cp(
    new URL("../src/server/migrations/", import.meta.url),
    new URL("src/server/migrations/", stage),
    { recursive: true }
  );
if (manifest.scripts["build:shell"]) {
  execFileSync("bun", ["run", "build:shell"], { cwd: root, stdio: "inherit" });
  await checkSize(new URL("../dist/shell/", import.meta.url));
  await cp(new URL("../dist/shell/", import.meta.url), new URL("dist/shell/", stage), {
    recursive: true,
  });
} else console.warn("SKIP shell build and UT-085 real bundle: build:shell is not integrated yet");
for (const [key, source] of Object.entries(manifest.exports)) {
  const path = typeof source === "string" ? source : source.default;
  if (key.endsWith("/*")) {
    manifest.exports[key] = { default: path };
    continue;
  }
  if (!existsSync(new URL(`../${path}`, import.meta.url))) {
    console.warn(`SKIP absent slice ${key}: ${path}`);
    delete manifest.exports[key];
    continue;
  }
  manifest.exports[key] = {
    types: path.replace(/\.ts$/, ".d.ts"),
    default: path.replace(/\.ts$/, ".js"),
  };
}
const cliFile = new URL("src/cli/main.js", stage);
await writeFile(
  cliFile,
  (await readFile(cliFile, "utf8"))
    .replace(/^#!.*\n/, "")
    .replaceAll(
      "import.meta.main",
      '(import.meta.main || (await import("node:fs")).realpathSync((await import("node:url")).fileURLToPath(import.meta.url)) === (await import("node:fs")).realpathSync(process.argv[1]))'
    )
    .replace(/^/, "#!/usr/bin/env node\n")
);
await chmod(cliFile, 0o755);
manifest.bin = { proto: "./src/cli/main.js" };
await cp(new URL("../skills/", import.meta.url), new URL("skills/", stage), { recursive: true });
manifest.files = ["src", "dist/shell", "skills", "README.md", "LICENSE"];
delete manifest.scripts;
delete manifest.devDependencies;
await writeFile(new URL("package.json", stage), JSON.stringify(manifest, null, 2) + "\n");
for (const name of ["README.md", "LICENSE"]) {
  if (existsSync(new URL(`../${name}`, import.meta.url)))
    await cp(new URL(`../${name}`, import.meta.url), new URL(name, stage));
}
