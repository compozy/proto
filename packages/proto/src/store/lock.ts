import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { ProtoError } from "../model/errors.ts";
const exec = promisify(execFile);
export type LockOwner = { token: string; pid: number; processStartedAt: string; hostId: string };
export type LockEnvironment = {
  hostId(): Promise<string>;
  processStartedAt(pid: number): Promise<string | null>;
  alive(pid: number): boolean;
};
export const systemLockEnvironment: LockEnvironment = {
  async hostId() {
    if (process.platform === "linux") return (await readFile("/etc/machine-id", "utf8")).trim();
    if (process.platform === "darwin") {
      const { stdout } = await exec("ioreg", ["-rd1", "-c", "IOPlatformExpertDevice"]);
      const id = /"IOPlatformUUID"\s*=\s*"([^"]+)"/.exec(stdout)?.[1];
      if (id) return id;
    }
    if (process.platform === "win32") {
      const { stdout } = await exec("reg", [
        "query",
        "HKLM\\SOFTWARE\\Microsoft\\Cryptography",
        "/v",
        "MachineGuid",
      ]);
      const id = /MachineGuid\s+REG_SZ\s+(\S+)/.exec(stdout)?.[1];
      if (id) return id;
    }
    throw new Error("Unable to determine machine identity");
  },
  async processStartedAt(pid) {
    try {
      if (process.platform === "linux") {
        const value = await readFile(`/proc/${pid}/stat`, "utf8");
        return value.slice(value.lastIndexOf(")") + 2).split(" ")[19] ?? null;
      }
      if (process.platform === "win32")
        return (
          (
            await exec("powershell", [
              "-NoProfile",
              "-Command",
              `(Get-Process -Id ${pid}).StartTime.ToUniversalTime().Ticks`,
            ])
          ).stdout.trim() || null
        );
      return (
        (
          await exec("ps", ["-p", String(pid), "-o", "lstart="], {
            env: { ...process.env, TZ: "UTC", LC_ALL: "C" },
          })
        ).stdout.trim() || null
      );
    } catch {
      return null;
    }
  },
  alive(pid) {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code !== "ESRCH";
    }
  },
};
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";
export async function readOwner(path: string): Promise<LockOwner | null> {
  try {
    const owner: unknown = JSON.parse(await readFile(join(path, "owner.json"), "utf8"));
    if (
      typeof owner === "object" &&
      owner !== null &&
      "token" in owner &&
      typeof owner.token === "string" &&
      "pid" in owner &&
      Number.isSafeInteger(owner.pid) &&
      Number(owner.pid) > 0 &&
      "hostId" in owner &&
      typeof owner.hostId === "string" &&
      "processStartedAt" in owner &&
      typeof owner.processStartedAt === "string"
    )
      return owner as LockOwner;
    return null;
  } catch (error) {
    if (missing(error) || error instanceof SyntaxError) return null;
    throw error;
  }
}
export class KeyLocks {
  readonly directory: string;
  readonly environment: LockEnvironment;
  constructor(directory: string, environment: LockEnvironment = systemLockEnvironment) {
    this.directory = directory;
    this.environment = environment;
  }
  path(key: string) {
    return join(this.directory, `${key}.lock`);
  }
  async dead(owner: LockOwner) {
    if (owner.hostId !== (await this.environment.hostId())) return false;
    if (!this.environment.alive(owner.pid)) return true;
    const started = await this.environment.processStartedAt(owner.pid);
    return started !== null && started !== owner.processStartedAt;
  }
  /** Recheck the observed token while holding the short takeover mutex. */
  async reclaim(key: string, observed: LockOwner) {
    if (!(await this.dead(observed))) return;
    const guard = `${this.path(key)}.takeover`;
    try {
      await mkdir(guard);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        if (Date.now() - (await stat(guard)).mtimeMs > 5000)
          await rm(guard, { recursive: true, force: true });
      } catch (cause) {
        if (!missing(cause)) throw cause;
      }
      return;
    }
    try {
      const current = await readOwner(this.path(key));
      if (current?.token !== observed.token || !(await this.dead(current))) return;
      const tombstone = `${this.path(key)}.${crypto.randomUUID()}.tmp`;
      await rename(this.path(key), tombstone);
      await rm(tombstone, { recursive: true, force: true });
    } finally {
      await rm(guard, { recursive: true, force: true });
    }
  }
  async acquire(key: string): Promise<() => Promise<void>> {
    await mkdir(this.directory, { recursive: true });
    const started = performance.now();
    const hostId = await this.environment.hostId();
    const processStartedAt = await this.environment.processStartedAt(process.pid);
    if (!processStartedAt)
      throw new ProtoError("key_busy", "Cannot establish lock owner start time.");
    const owner = { token: crypto.randomUUID(), pid: process.pid, processStartedAt, hostId };
    let observed: LockOwner | null = null;
    while (performance.now() - started < 5000) {
      try {
        await mkdir(this.path(key));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        observed = await readOwner(this.path(key));
        if (observed) await this.reclaim(key, observed);
        await delay(15 + Math.random() * 20);
        continue;
      }
      try {
        await writeFile(join(this.path(key), "owner.json"), JSON.stringify(owner), { flag: "wx" });
      } catch (error) {
        await rm(this.path(key), { recursive: true, force: true });
        throw error;
      }
      return async () => {
        if ((await readOwner(this.path(key)))?.token === owner.token)
          await rm(this.path(key), { recursive: true, force: true });
      };
    }
    throw new ProtoError(
      "key_busy",
      `The review key is busy${observed ? ` (host ${observed.hostId})` : " (owner unknown)"}; retry.`
    );
  }
  async run<T>(key: string, action: () => Promise<T>) {
    const release = await this.acquire(key);
    try {
      return await action();
    } finally {
      await release();
    }
  }
  async unlock(key: string) {
    const owner = await readOwner(this.path(key));
    // Force is operator recovery, not a way to evict a known live writer on this host.
    if (owner && owner.hostId === (await this.environment.hostId()) && !(await this.dead(owner)))
      throw new ProtoError("key_busy", "Cannot unlock a live local writer.");
    const tombstone = `${this.path(key)}.${crypto.randomUUID()}.tmp`;
    try {
      await rename(this.path(key), tombstone);
      await rm(tombstone, { recursive: true, force: true });
    } catch (error) {
      if (!missing(error)) throw error;
    }
    return { removedOwner: owner ? { hostId: owner.hostId, pid: owner.pid } : null };
  }
}
