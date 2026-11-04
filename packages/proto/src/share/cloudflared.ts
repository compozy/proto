import { createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { access, chmod, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { ProtoError } from "../model/errors.ts";

const exec = promisify(execFile);
export const cloudflaredVersion = "2026.10.5";
// Official release asset digests: https://github.com/cloudflare/cloudflared/releases/tag/2026.10.5
export const cloudflaredAssets: Record<string, { name: string; sha256: string }> = {
  "darwin-x64": { name: "cloudflared-darwin-amd64.tgz", sha256: "6699392fed92367808c248c2d90bed66e49bbf66e1b4ee3e4141230f3f7391b3" },
  "darwin-arm64": { name: "cloudflared-darwin-arm64.tgz", sha256: "184c7d4f5f977348243a6d7ca8f6cf6073b9b2746cfe8c1fe15aa59e9a522bf0" },
  "linux-x64": { name: "cloudflared-linux-amd64", sha256: "e1bc0cf084fd9e590554fe769a86b1db46701c3f847a43d902f7b974a4e16298" },
  "linux-arm64": { name: "cloudflared-linux-arm64", sha256: "72e0d05a67e09da87cf495e409a28c3cc5994dd23fc66a982eebea6a55923b7d" },
  "linux-arm": { name: "cloudflared-linux-arm", sha256: "a018911e1bbfd739937f3011f589e9e73245baeee14742f8b3413472bb007adc" },
  "linux-ia32": { name: "cloudflared-linux-386", sha256: "f2de713829081837130b38e27f3c95aa9d7fc1a4f48b833362d21234dd8780d8" },
  "win32-x64": { name: "cloudflared-windows-amd64.exe", sha256: "db4e4c413612a0916f3e1679d3caaf376f94911952d163028fb726fb2e0516a9" },
  "win32-ia32": { name: "cloudflared-windows-386.exe", sha256: "66cba8003e4f87a8e6b772f331b8c04c7d41ac4f2dc30dd2c13ae09de3b6007e" },
};
export function supportedVersion(output: string) {
  const version = output.match(/\b(\d{4})\.(\d+)\.(\d+)\b/);
  return !!version && (Number(version[1]) > 2026 || (Number(version[1]) === 2026 && Number(version[2]) >= 1));
}
export async function locateCloudflared(options: {
  path?: string; cache?: string; platform?: string; arch?: string; fetch?: typeof fetch;
} = {}) {
  const platform = options.platform ?? process.platform, arch = options.arch ?? process.arch;
  const executable = platform === "win32" ? "cloudflared.exe" : "cloudflared";
  for (const directory of (options.path ?? process.env.PATH ?? "").split(delimiter)) {
    if (!directory) continue;
    const candidate = join(directory, executable);
    try {
      await access(candidate, constants.X_OK);
      if (supportedVersion((await exec(candidate, ["--version"], { timeout: 5000 })).stdout)) return candidate;
    } catch { /* Missing, unusable or old PATH binary: use the pinned asset. */ }
  }
  const asset = cloudflaredAssets[`${platform}-${arch}`];
  if (!asset) throw new ProtoError("cloudflared_unavailable");
  const cache = options.cache ?? join(homedir(), ".cache/compozy-proto");
  await mkdir(cache, { recursive: true, mode: 0o700 });
  const destination = join(cache, `${cloudflaredVersion}-${platform}-${arch}-${executable}`);
  // Reverify cached downloads too; no unchecked executable is reused.
  const archive = join(cache, `${cloudflaredVersion}-${asset.name}`);
  const temporary = await mkdtemp(join(cache, ".download-"));
  try {
    let bytes: Buffer;
    try { bytes = await readFile(archive); }
    catch {
      const response = await (options.fetch ?? fetch)(`https://github.com/cloudflare/cloudflared/releases/download/${cloudflaredVersion}/${asset.name}`, { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error("Download failed");
      bytes = Buffer.from(await response.arrayBuffer());
    }
    if (createHash("sha256").update(bytes).digest("hex") !== asset.sha256) {
      await rm(archive, { force: true }); await rm(destination, { force: true });
      throw new Error("Checksum mismatch");
    }
    const downloaded = join(temporary, "asset");
    await writeFile(downloaded, bytes, { mode: 0o600 });
    let binary = downloaded;
    if (asset.name.endsWith(".tgz")) {
      await exec("tar", ["-xzf", downloaded, "-C", temporary, "cloudflared"]);
      binary = join(temporary, "cloudflared");
    }
    await chmod(binary, 0o700);
    await rename(binary, destination);
    if (!asset.name.endsWith(".tgz")) await writeFile(archive, bytes, { mode: 0o600 });
    else await rename(downloaded, archive);
    return destination;
  } catch { throw new ProtoError("cloudflared_unavailable"); }
  finally { await rm(temporary, { recursive: true, force: true }); }
}

// Inline source works in the distributed CLI without resolving a TS entry under Node.
const sentinelSource = `
const { spawn } = require('node:child_process');
const child = spawn(process.env.PROTO_CLOUDFLARED_BINARY, ['tunnel', '--no-autoupdate', '--metrics', '127.0.0.1:0', 'run'], { stdio: ['ignore', 'ignore', 'ignore'], env: process.env });
let ending = false;
function stop() {
  if (ending) return;
  ending = true;
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
  timer.unref();
}
child.once('spawn', () => process.stdout.write(String(child.pid) + '\\n'));
child.once('error', () => process.exit(1));
child.once('exit', code => process.exit(ending ? 0 : (code || 1)));
process.stdin.resume();
process.stdin.once('end', stop);
process.stdin.once('close', stop);
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
`;
export async function spawnCloudflared(binary: string, token: string) {
  const env = { ...process.env };
  delete env.CLOUDFLARE_API_TOKEN;
  const sentinel = spawn(process.execPath, ["-e", sentinelSource], {
    detached: true, stdio: ["pipe", "pipe", "ignore"], env: { ...env, TUNNEL_TOKEN: token, PROTO_CLOUDFLARED_BINARY: binary },
  });
  // The connector may exit before teardown closes its input pipe.
  sentinel.stdin.on("error", () => {});
  const exited = new Promise<number | null>(resolve => {
    sentinel.once("exit", resolve);
    sentinel.once("error", () => resolve(1));
  });
  const pid = await new Promise<number>((resolve, reject) => {
    let line = "";
    const timer = setTimeout(() => { sentinel.stdin.end(); reject(new ProtoError("cloudflared_unavailable")); }, 10000);
    const fail = () => { clearTimeout(timer); reject(new ProtoError("cloudflared_unavailable")); };
    sentinel.once("error", fail); sentinel.once("exit", fail);
    sentinel.stdout.on("data", (chunk: Buffer) => {
      line += chunk.toString();
      if (!line.includes("\n")) return;
      clearTimeout(timer);
      sentinel.removeListener("error", fail); sentinel.removeListener("exit", fail);
      const value = Number(line.trim());
      if (!Number.isSafeInteger(value) || value < 1) { sentinel.stdin.end(); fail(); }
      else resolve(value);
    });
  });
  return { pid, sentinel, exited, async close() { sentinel.stdin.end(); await exited; } };
}
