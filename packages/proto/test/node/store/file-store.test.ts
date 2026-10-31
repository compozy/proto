import { execFile, spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, mkdir, stat, utimes } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, describe, expect, it } from "vitest";
import { FileStore } from "../../../src/store/file-store.ts";
import {
  KeyLocks,
  readOwner,
  type LockEnvironment,
  type LockOwner,
} from "../../../src/store/lock.ts";
import { makeFileStore } from "./harness.ts";
import { runStoreContract, input, reviewer, png } from "./contract.ts";
runStoreContract(makeFileStore);
const exec = promisify(execFile);
const worker = fileURLToPath(new URL("./process.ts", import.meta.url));
export async function runProcess(mode: string, root: string, id = "login-form-1") {
  return exec(process.execPath, ["--experimental-transform-types", worker, mode, root, id]);
}
function start(mode: string, root: string) {
  const child = spawn(
    process.execPath,
    ["--experimental-transform-types", worker, mode, root, "login-form-1"],
    { stdio: ["ignore", "pipe", "pipe"] }
  );
  return child;
}
function ready(child: ChildProcess, expected: string) {
  return new Promise<void>((resolve, reject) => {
    let output = "",
      errors = "";
    child.stderr!.on("data", data => {
      errors += String(data);
    });
    const timer = setTimeout(() => reject(new Error(`Process not ready: ${errors}`)), 10000);
    child.stdout!.on("data", data => {
      output += String(data);
      if (output.includes(expected)) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once("exit", code => {
      clearTimeout(timer);
      if (!output.includes(expected)) reject(new Error(`Exited ${code}: ${errors}`));
    });
  });
}
const environment: LockEnvironment = {
  hostId: async () => "test-host",
  alive: pid => pid === process.pid,
  processStartedAt: async pid => (pid === process.pid ? "current" : null),
};
const owner = (overrides: Partial<LockOwner> = {}): LockOwner => ({
  token: crypto.randomUUID(),
  pid: 2147483647,
  processStartedAt: "old",
  hostId: "test-host",
  ...overrides,
});
describe("FileStore filesystem invariants", () => {
  const cleanup: (() => Promise<void>)[] = [];
  afterEach(async () => {
    for (const dispose of cleanup.splice(0)) await dispose();
  });
  async function harness() {
    const h = await makeFileStore();
    cleanup.push(h.dispose);
    return h;
  }
  it("UT-026: v3 commits use full git HEAD and support node targets", async () => {
    const { root, store } = await harness();
    await exec("git", ["init", "--quiet", root]);
    await exec("git", [
      "-C",
      root,
      "-c",
      "user.name=Proto",
      "-c",
      "user.email=proto@example.test",
      "commit",
      "--allow-empty",
      "--no-verify",
      "-m",
      "fixture",
    ]);
    const sha = (await exec("git", ["-C", root, "rev-parse", "HEAD"])).stdout.trim();
    const comment = await store.add("login-form", input, reviewer);
    expect(comment.context.commit).toBe(sha);
    expect(sha).toMatch(/^[a-f0-9]{40}$/);
    expect(
      JSON.parse(await readFile(join(store.directory, "login-form.json"), "utf8"))
    ).toMatchObject({ version: 3, sequence: 1 });
    expect((await store.add("flow-sign-in", input, reviewer)).target).toEqual(input.target);
  });
  it("UT-031 / UT-068: live or foreign owners are never age-evicted; waiting yields to timers", async () => {
    const { store } = await harness();
    await store.ready();
    const locks = new KeyLocks(store.directory, environment);
    const live = owner({ pid: process.pid, processStartedAt: "current" });
    const foreign = owner({ hostId: "another-host" });
    for (const [key, value] of [
      ["login-form", live],
      ["flow-sign-in", foreign],
    ] as const) {
      await mkdir(locks.path(key));
      await writeFile(join(locks.path(key), "owner.json"), JSON.stringify(value));
      const old = new Date(Date.now() - 600000);
      await utimes(locks.path(key), old, old);
    }
    let timerFired = false;
    const timer = setTimeout(() => {
      timerFired = true;
    }, 25);
    const attempts = await Promise.allSettled([
      locks.acquire("login-form"),
      locks.acquire("flow-sign-in"),
    ]);
    clearTimeout(timer);
    expect(timerFired).toBe(true);
    for (const attempt of attempts) {
      expect(attempt.status).toBe("rejected");
      if (attempt.status === "rejected") expect(attempt.reason).toMatchObject({ code: "key_busy" });
    }
    expect(await readOwner(locks.path("login-form"))).toEqual(live);
    expect(await readOwner(locks.path("flow-sign-in"))).toEqual(foreign);
  }, 12000);
  it("UT-031: dead owners and reused pids can be reclaimed", async () => {
    const { store } = await harness();
    await store.ready();
    const locks = new KeyLocks(store.directory, environment);
    for (const value of [
      owner(),
      owner({ pid: process.pid, processStartedAt: "different-start" }),
    ]) {
      await mkdir(locks.path("login-form"));
      await writeFile(join(locks.path("login-form"), "owner.json"), JSON.stringify(value));
      const release = await locks.acquire("login-form");
      expect((await readOwner(locks.path("login-form")))?.token).not.toBe(value.token);
      await release();
    }
  });
  it("UT-066: a delayed second reclaimer cannot rename a newly acquired lock", async () => {
    const { store } = await harness();
    await store.ready();
    const locks = new KeyLocks(store.directory, environment),
      dead = owner();
    await mkdir(locks.path("login-form"));
    await writeFile(join(locks.path("login-form"), "owner.json"), JSON.stringify(dead));
    const a = await readOwner(locks.path("login-form")),
      b = await readOwner(locks.path("login-form"));
    await locks.reclaim("login-form", a!);
    const release = await locks.acquire("login-form");
    const current = await readOwner(locks.path("login-form"));
    await locks.reclaim("login-form", b!);
    expect(await readOwner(locks.path("login-form"))).toEqual(current);
    await release();
  });
  // Lock-layer invariant: an awaited liveness probe never permits a live takeover owner to be evicted.
  it("UT-066: paused takeover owner survives an aged guard and a competing reclaimer", async () => {
    const { store } = await harness();
    await store.ready();
    const dead = owner({ processStartedAt: "old" });
    let calls = 0;
    let resume!: () => void;
    let paused!: () => void;
    const waiting = new Promise<void>(resolve => {
      paused = resolve;
    });
    const barrier = new Promise<void>(resolve => {
      resume = resolve;
    });
    const env = {
      ...environment,
      alive: () => true,
      async processStartedAt(pid: number) {
        if (pid === dead.pid && ++calls === 2) {
          paused();
          await barrier;
        }
        return "start";
      },
    };
    const a = new KeyLocks(store.directory, env);
    const b = new KeyLocks(store.directory, { ...environment, alive: () => true });
    await mkdir(a.path("login-form"));
    await writeFile(join(a.path("login-form"), "owner.json"), JSON.stringify(dead));
    const reclaim = a.reclaim("login-form", dead);
    await waiting;
    const guard = `${a.path("login-form")}.takeover`;
    const guardOwner = await readOwner(guard);
    const old = new Date(Date.now() - 60000);
    await utimes(guard, old, old);
    await b.reclaim("login-form", dead);
    await b.reclaim("login-form", dead);
    expect(await readOwner(guard)).toEqual(guardOwner);
    expect(await readOwner(a.path("login-form"))).toEqual(dead);
    resume();
    await reclaim;
    const release = await b.acquire("login-form");
    expect(await readOwner(b.path("login-form"))).not.toBeNull();
    await release();
  });
  it("UT-067: token-matched release never removes another owner's lock", async () => {
    const { store } = await harness();
    await store.ready();
    const locks = new KeyLocks(store.directory, environment);
    const release = await locks.acquire("login-form");
    const replacement = owner();
    await writeFile(join(locks.path("login-form"), "owner.json"), JSON.stringify(replacement));
    await release();
    expect(await readOwner(locks.path("login-form"))).toEqual(replacement);
  });
  it.skipIf(process.platform === "win32")(
    "UT-067: SIGSTOP for 30 seconds retains ownership until resume",
    async () => {
      const { root, store } = await harness();
      const child = start("pause", root);
      try {
        await ready(child, "locked");
        child.kill("SIGSTOP");
        const startAt = Date.now();
        await expect(store.locks.acquire("login-form")).rejects.toMatchObject({ code: "key_busy" });
        await delay(Math.max(0, 30000 - (Date.now() - startAt)));
        expect(await readOwner(store.locks.path("login-form"))).not.toBeNull();
        const exited = new Promise<void>(resolve => child.once("exit", () => resolve()));
        child.kill("SIGCONT");
        await exited;
        expect((await store.readFile("login-form")).sequence).toBe(1);
        expect(await readOwner(store.locks.path("login-form"))).toBeNull();
      } finally {
        child.kill("SIGCONT");
        child.kill("SIGKILL");
      }
    },
    45000
  );
  it("UT-032: killed writer between temporary write and rename leaves published data intact", async () => {
    const { root, store } = await harness();
    await store.add("login-form", input, reviewer);
    const before = await readFile(join(store.directory, "login-form.json"), "utf8");
    const child = start("crash", root);
    try {
      await ready(child, "temp-ready");
      const exited = new Promise<void>(resolve => child.once("exit", () => resolve()));
      child.kill("SIGKILL");
      await exited;
      expect(await readFile(join(store.directory, "login-form.json"), "utf8")).toBe(before);
      await store.reply("login-form-1", { body: "Recovered" }, reviewer);
      expect((await store.get("login-form-1")).thread).toHaveLength(2);
    } finally {
      child.kill("SIGKILL");
    }
  }, 15000);
  it("UT-035: attachment reads do not wait for the mutation lock", async () => {
    const { store } = await harness();
    const image = await store.upload("login-form", { name: "pixel.png", bytes: png }, reviewer);
    await store.add("login-form", { ...input, attachments: [image.id] }, reviewer);
    const release = await store.locks.acquire("login-form");
    try {
      expect((await store.readAttachment("login-form", image.id)).bytes).toEqual(png);
    } finally {
      await release();
    }
  });
  it("UT-036: opening purges expired pending uploads", async () => {
    const { root, store } = await harness();
    const image = await store.upload("login-form", { name: "shot.png", bytes: png }, reviewer);
    const later = new FileStore({ root, clock: () => new Date(Date.parse(image.expiresAt) + 1) });
    await later.ready();
    await expect(
      stat(join(store.directory, ".pending/login-form", `${image.id}.json`))
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(
      later.add("login-form", { ...input, attachments: [image.id] }, reviewer)
    ).rejects.toMatchObject({ code: "attachment_expired" });
  });
  it("UT-098: explicit unlock reports a foreign owner even with pending uploads", async () => {
    const { store } = await harness();
    await store.upload("login-form", { name: "shot.png", bytes: png }, reviewer);
    const locks = new KeyLocks(store.directory, environment),
      value = owner({ hostId: "foreign" });
    await mkdir(locks.path("login-form"));
    await writeFile(join(locks.path("login-form"), "owner.json"), JSON.stringify(value));
    const reopened = new FileStore({ ...store.options, lockEnvironment: environment });
    expect(await reopened.unlock("login-form", { force: true })).toEqual({
      removedOwner: { hostId: "foreign", pid: value.pid },
    });
  });
  it("IT-005: 20 parallel OS processes append without losing replies or sequence", async () => {
    const { root, store } = await harness();
    await store.add("login-form", input, reviewer);
    await Promise.all(Array.from({ length: 20 }, () => runProcess("reply", root)));
    expect((await store.get("login-form-1")).thread).toHaveLength(21);
    expect((await store.readFile("login-form")).sequence).toBe(1);
  }, 90000);
});
