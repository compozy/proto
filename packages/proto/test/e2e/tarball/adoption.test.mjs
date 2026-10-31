import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, realpath, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: "utf8", timeout: 180000 });

test(
  "E2E-001: install the real tarball in a fresh Vite React consumer",
  { timeout: 240000 },
  async t => {
    const temp = await realpath(await mkdtemp(join(tmpdir(), "proto-adoption-")));
    try {
      const stage = join(root, "dist/package");
      assert.ok(existsSync(join(stage, "package.json")), "Run the package build first");
      const packed = JSON.parse(
        run("npm", ["pack", stage, "--ignore-scripts", "--json", "--pack-destination", temp], temp)
      )[0];
      const app = join(temp, "consumer");
      await mkdir(join(app, "src"), { recursive: true });
      const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
      await writeFile(
        join(app, "package.json"),
        JSON.stringify({
          name: "tarball-consumer",
          private: true,
          type: "module",
          dependencies: {
            "@compozy/proto": `file:${join(temp, packed.filename)}`,
            react: manifest.peerDependencies.react,
            "react-dom": manifest.peerDependencies["react-dom"],
            vite: manifest.dependencies.vite,
            "@vitejs/plugin-react": manifest.devDependencies["@vitejs/plugin-react"],
          },
        })
      );
      run(
        "npm",
        ["install", "--ignore-scripts", "--legacy-peer-deps", "--no-audit", "--no-fund"],
        app
      );
      const installed = join(app, "node_modules/@compozy/proto");
      await t.test(
        "public exports and Node/Bun bin resolve without workspace packages",
        async () => {
          const available = [".", "./flow", "./config", "./vite", "./node", "./server", "./mcp"];
          run(
            "node",
            [
              "--input-type=module",
              "-e",
              `for (const p of ${JSON.stringify(available)}) await import(p === '.' ? '@compozy/proto' : '@compozy/proto' + p.slice(1));`,
            ],
            app
          );
          const bin = join(app, "node_modules/.bin/proto");
          const packedManifest = JSON.parse(
            await readFile(join(installed, "package.json"), "utf8")
          );
          for (const [key, entry] of Object.entries(packedManifest.exports)) {
            if (key.endsWith("/*")) continue;
            assert.ok(existsSync(join(installed, entry.types)));
            assert.ok(existsSync(join(installed, entry.default)));
          }
          assert.ok(JSON.parse(run("node", [bin, "--help"], app)).commands.includes("build"));
          assert.ok(JSON.parse(run("bun", [bin, "--help"], app)).commands.includes("init"));
          assert.ok(
            packed.files.some(file => file.path === "src/server/migrations/0001_review.sql")
          );
          run(
            "node",
            [
              "--input-type=module",
              "-e",
              `import {readFileSync} from "node:fs"; const sql=readFileSync(new URL(import.meta.resolve("@compozy/proto/server/migrations/0001_review.sql")),"utf8"); if (!sql.includes("CREATE TABLE")) throw Error("Missing SQL migration");`,
            ],
            app
          );
          run("node", [bin, "dev", "--help"], app);
          run("node", [bin, "check", "--help"], app);
          assert.ok(existsSync(join(installed, "src/render/main.tsx")));
          assert.ok(!existsSync(join(app, "node_modules/@proto/ui")));
        }
      );
      await writeFile(
        join(app, "vite.config.ts"),
        `import react from "@vitejs/plugin-react"; export default {plugins:[react()]};`
      );
      await t.test("proto init scaffolds the consumer", () => {
        run("node", [join(installed, "src/cli/main.js"), "init", "--skills"], app);
        assert.ok(existsSync(join(app, "proto.config.ts")));
        assert.ok(existsSync(join(app, ".agents/skills/author-prototype/SKILL.md")));
        run("node", [join(installed, "src/cli/main.js"), "check", "--json"], app);
      });
      await writeFile(
        join(app, "proto.config.ts"),
        `export default { title: 'Tarball consumer' };`
      );
      await writeFile(
        join(app, "proto.canvas.tsx"),
        `export function Canvas({children}) { return children; }`
      );
      await writeFile(
        join(app, "src/example.proto.tsx"),
        `import {definePrototype} from "@compozy/proto"; import {View} from "./view"; export const meta = definePrototype({ title: "Example", states: [{id:"default",label:"Default"}] }); export default View;`
      );
      await writeFile(
        join(app, "src/view.tsx"),
        `export function View(){return <button>Tarball</button>}`
      );
      await writeFile(join(app, "index.html"), '<div id="root"></div>');
      await t.test(
        "dev Node entry serves bootstrap and compiles render from consumer graph",
        async () => {
          const script = `
import assert from 'node:assert/strict';
import { loadProject, startDev } from '@compozy/proto/node';
const project = await loadProject(process.cwd());
let server;
for (let port = 24000; port < 24100; port += 2) {
 try { server = await startDev(project, {port}); break; } catch (e) { if (e.code !== 'port_in_use') throw e; }
}
assert.ok(server);
try {
 const response = await fetch(server.origin + '/__proto/bootstrap.json');
 assert.equal(response.status, 200);
 const bootstrap = await response.json();
 assert.equal(bootstrap.title, 'Tarball consumer');
 const render = await fetch(server.renderOrigin + '/__proto/render/example');
 assert.equal(render.status, 200);
 assert.match(await render.text(), /script/);
 if (${existsSync(join(stage, "dist/shell/index.html"))}) { const shell = await fetch(server.origin); assert.equal(shell.status, 200); assert.match(await shell.text(), /<script/); }
 const source = await fetch(server.renderOrigin + '/@fs/' + ${JSON.stringify(join(installed, "src/render/main.tsx"))});
 assert.equal(source.status, 200);
} finally { await server.close(); }
`;
          await writeFile(join(app, "smoke.mjs"), script);
          run("node", ["smoke.mjs"], app);
        }
      );
      await t.test("catalog build emits the static read-only distribution", async () => {
        run("node", [join(installed, "src/cli/main.js"), "build", "--json"], app);
        const bootstrap = JSON.parse(
          await readFile(join(app, "dist-proto/__proto/bootstrap.json"), "utf8")
        );
        assert.equal(bootstrap.mode, "read-only");
        assert.equal(bootstrap.reviewSnapshotBase, null);
        assert.ok(existsSync(join(app, "dist-proto/__proto/render/index.html")));
        assert.ok(!existsSync(join(app, "dist-gallery")));
      });
      await t.test("prebuilt shell is shipped", async () => {
        assert.match(await readFile(join(installed, "dist/shell/index.html"), "utf8"), /<script/);
      });
      await t.test("CLI dev serves the consumer", async () => {
        // Exercise the CLI using an independent child and a real HTTP endpoint.
        const { spawn } = await import("node:child_process");
        const child = spawn(
          "node",
          [join(installed, "src/cli/main.js"), "dev", "--port", "24320"],
          { cwd: app, stdio: "ignore" }
        );
        const exited = new Promise(resolve => child.once("exit", resolve));
        try {
          let response;
          for (let attempt = 0; attempt < 100; attempt++) {
            try {
              response = await fetch("http://127.0.0.1:24320/__proto/bootstrap.json");
              if (response.ok) break;
            } catch {}
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          assert.equal(response?.status, 200);
          assert.equal((await response.json()).title, "Tarball consumer");
        } finally {
          child.kill("SIGTERM");
          await exited;
        }
      });
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  }
);
