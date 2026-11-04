import { randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { errorBody, ProtoError } from "../model/errors.ts";
import type { Registry } from "../model/registry.ts";
import { loadProject, type ProtoProject } from "../node/project.ts";
import { ReviewEvents } from "../review/events.ts";
import { createReviewServer } from "../server/server.ts";
import { fileStorage } from "../server/file.ts";
import type { ReviewServerOptions } from "../server/types.ts";
import type { FileStore } from "../store/file-store.ts";
import { KeyLocks, systemLockEnvironment } from "../store/lock.ts";
import { prefetchAccessAuthorizer, type Invitee } from "./access.ts";
import { CloudflareClient } from "./cloudflare.ts";
import { locateCloudflared, spawnCloudflared } from "./cloudflared.ts";
import {
  checkConnection,
  closeInvitations,
  openInvitations,
  readConnection,
  setIngress,
  type Connection,
} from "./connection.ts";
import { serveHandler } from "./http.ts";
import { notInvitedPage } from "./pages.ts";
import { buildAndSwap, cleanupSnapshots, shareDirectory, type ShareTarget } from "./snapshot.ts";

export type ShareOptions = {
  target: ShareTarget;
  approvers: readonly string[];
  commenters: readonly string[];
};
export type ShareActivity =
  | { type: "joined"; email: string }
  | { type: "commented"; email: string; key: string; commentId: string }
  | { type: "approved"; email: string; key: string; commit: string | null };
type Invitation = { email: string; role: "approver" | "commenter" };
export type ShareSummary = {
  link: string;
  target: ShareTarget;
  invitees: Invitation[];
  snapshot: string;
  commit: string | null;
};
type SessionRecord = Omit<ShareSummary, "link"> & {
  pid: number;
  pidStartedAt: string;
  cloudflaredPid?: number;
  cloudflaredStartedAt?: string;
  controlPort: number;
  controlToken: string;
  root: string;
  url: string;
  startedAt: string;
};
/** Explicit I/O seams; no environment override can redirect the Cloudflare API. */
export type ShareRuntime = {
  path?: string;
  connectionPath?: string;
  client?: CloudflareClient;
  fetch?: typeof fetch;
  binary?: string;
  shellDir?: string;
  readinessTimeout?: number;
  statusTimeout?: number;
  activity?: (event: ShareActivity) => void;
  notice?: (message: string) => void;
  log?: ReviewServerOptions["log"];
};
export type ShareSession = {
  summary: ShareSummary;
  closed: Promise<ProtoError | null>;
  refresh(): Promise<{ snapshot: string; commit: string | null }>;
  stop(): Promise<void>;
};
export const sessionPath = () => join(homedir(), ".config/compozy-proto/share-session.json");
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";
async function recordAt(path: string): Promise<SessionRecord | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as SessionRecord;
  } catch (error) {
    if (missing(error) || error instanceof SyntaxError) return null;
    throw error;
  }
}
async function live(pid: number, identity: string) {
  return (
    Number.isSafeInteger(pid) &&
    pid > 0 &&
    typeof identity === "string" &&
    !!identity &&
    systemLockEnvironment.alive(pid) &&
    (await systemLockEnvironment.processStartedAt(pid)) === identity
  );
}
async function active(path: string) {
  const value = await recordAt(path);
  return value && (await live(value.pid, value.pidStartedAt)) ? value : null;
}
async function save(path: string, value: SessionRecord) {
  const temporary = `${path}.${randomBytes(8).toString("hex")}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(value) + "\n", { mode: 0o600, flag: "wx" });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}
export async function runningShare(runtime: ShareRuntime = {}) {
  const value = await active(runtime.path ?? sessionPath());
  return value ? { link: value.url } : null;
}
async function control<T>(method: string, route: string, runtime: ShareRuntime): Promise<T> {
  const value = await active(runtime.path ?? sessionPath());
  if (!value || !value.controlPort) throw new ProtoError("share_not_running");
  let response: Response;
  try {
    response = await fetch(`http://127.0.0.1:${value.controlPort}/${route}`, {
      method,
      headers: { Authorization: `Bearer ${value.controlToken}` },
      redirect: "error",
      signal: AbortSignal.timeout(route === "refresh" ? 300_000 : 30_000),
    });
  } catch {
    throw new ProtoError("share_not_running");
  }
  const result = await response.json();
  if (!response.ok) {
    const failure = result as { error: { code: ProtoError["code"]; message: string } };
    throw new ProtoError(failure.error.code, failure.error.message);
  }
  return result as T;
}
export async function shareStatus(
  runtime: ShareRuntime = {}
): Promise<
  { running: false } | (ShareSummary & { running: true; tunnel: string; startedAt: string })
> {
  const value = await active(runtime.path ?? sessionPath());
  if (!value) return { running: false as const };
  if (!value.controlPort)
    return {
      running: true,
      link: value.url,
      target: value.target,
      invitees: value.invitees,
      snapshot: value.snapshot,
      commit: value.commit,
      tunnel: "starting",
      startedAt: value.startedAt,
    };
  return control<ShareSummary & { running: true; tunnel: string; startedAt: string }>(
    "GET",
    "status",
    runtime
  );
}
export async function refreshShare(runtime: ShareRuntime = {}) {
  return control<{ snapshot: string; commit: string | null }>("POST", "refresh", runtime);
}
export async function stopShare(runtime: ShareRuntime = {}) {
  return control<{ stopped: true }>("POST", "stop", runtime);
}
async function closeControl(server: Server) {
  const stopped = new Promise<void>(resolve => server.close(() => resolve()));
  server.closeIdleConnections();
  const deadline = setTimeout(() => server.closeAllConnections(), 10_000);
  try {
    await stopped;
  } finally {
    clearTimeout(deadline);
  }
}

export async function startShare(
  project: ProtoProject,
  options: ShareOptions,
  runtime: ShareRuntime = {}
): Promise<ShareSession> {
  const path = runtime.path ?? sessionPath();
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await chmod(dirname(path), 0o700);
  // Serialize read/reclaim/create across processes, including simultaneous starts.
  const locks = new KeyLocks(dirname(path));
  const pidStartedAt = await systemLockEnvironment.processStartedAt(process.pid);
  if (!pidStartedAt)
    throw new ProtoError("share_session_running", "Cannot establish session process identity.");
  const invitees: Invitation[] = [];
  for (const [emails, role] of [
    [options.approvers, "approver"],
    [options.commenters, "commenter"],
  ] as const)
    for (const raw of emails) {
      const email = raw.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ProtoError("invalid_input");
      if (!invitees.some(person => person.email === email)) invitees.push({ email, role });
    }
  if (!invitees.length) throw new ProtoError("share_no_invitees");
  const record: SessionRecord = {
    pid: process.pid,
    pidStartedAt,
    controlPort: 0,
    controlToken: randomBytes(32).toString("hex"),
    root: project.root,
    url: "",
    target: options.target,
    invitees,
    snapshot: "",
    commit: null,
    startedAt: new Date().toISOString(),
  };
  await locks.run("share-session", async () => {
    const previous = await recordAt(path);
    if (previous && (await live(previous.pid, previous.pidStartedAt)))
      throw new ProtoError(
        "share_session_running",
        `Already sharing at ${previous.url}. Run proto share stop.`
      );
    if (
      previous?.cloudflaredPid &&
      previous.cloudflaredStartedAt &&
      (await live(previous.cloudflaredPid, previous.cloudflaredStartedAt))
    ) {
      process.kill(previous.cloudflaredPid, "SIGTERM");
      const deadline = Date.now() + 5000;
      while (await live(previous.cloudflaredPid, previous.cloudflaredStartedAt)) {
        if (Date.now() >= deadline) {
          process.kill(previous.cloudflaredPid, "SIGKILL");
          break;
        }
        await delay(25);
      }
    }
    await save(path, record);
  });
  let connection: Connection | null = null;
  let client: CloudflareClient | undefined;
  let review: Awaited<ReturnType<typeof serveHandler>> | undefined;
  let controlServer: Server | undefined;
  let connector: Awaited<ReturnType<typeof spawnCloudflared>> | undefined;
  let stopReviews = () => {};
  let stopping = false;
  let stoppingPromise: Promise<void> | undefined;
  let refreshing: Promise<{ snapshot: string; commit: string | null }> | undefined;
  let resolveClosed!: (error: ProtoError | null) => void;
  const closed = new Promise<ProtoError | null>(resolve => {
    resolveClosed = resolve;
  });
  const notice = runtime.notice ?? (() => {});
  const summary: ShareSummary = {
    link: "",
    target: options.target,
    invitees,
    snapshot: "",
    commit: null,
  };
  const events = new ReviewEvents();
  const stop = (failure: ProtoError | null = null): Promise<void> => {
    stoppingPromise ??= (async () => {
      stopping = true;
      process.removeListener("SIGINT", onSignal);
      process.removeListener("SIGTERM", onSignal);
      try {
        await refreshing?.catch(() => {});
        if (connection) {
          try {
            await closeInvitations(connection, client);
          } catch {
            notice("Could not close Cloudflare invitations; the local tunnel is being closed.");
          }
        }
      } finally {
        stopReviews();
        try {
          const results = await Promise.allSettled([
            connector?.close(),
            review?.close(),
            controlServer ? closeControl(controlServer) : undefined,
          ]);
          if (results.some(result => result.status === "rejected"))
            notice("A share resource could not be closed cleanly.");
          try {
            await cleanupSnapshots(project.root);
          } catch {
            notice("Could not remove temporary share snapshots.");
          }
        } finally {
          try {
            await locks.run("share-session", async () => {
              if ((await recordAt(path))?.controlToken === record.controlToken)
                await rm(path, { force: true });
            });
          } catch {
            notice("Could not remove the private share session record.");
          }
          resolveClosed(failure);
        }
      }
    })();
    return stoppingPromise;
  };
  let started = false;
  let interrupted = false;
  const onSignal = () => {
    if (started) void stop();
    else {
      interrupted = true;
      process.removeListener("SIGINT", onSignal);
      process.removeListener("SIGTERM", onSignal);
    }
  };
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  const refresh = () => {
    if (stopping) return Promise.reject(new ProtoError("share_not_running"));
    refreshing ??= (async () => {
      const latest = await loadProject(project.root);
      const next = await buildAndSwap(latest, options.target, {
        remote: `https://${connection!.shellHost}`,
        approvers: options.approvers.length > 0,
        shellDir: runtime.shellDir,
      });
      Object.assign(record, { snapshot: next.snapshot, commit: next.commit });
      Object.assign(summary, { snapshot: next.snapshot, commit: next.commit });
      // The atomic swap committed this refresh; metadata I/O cannot roll it back.
      events.publish({ type: "snapshot", id: next.snapshot });
      try {
        await save(path, record);
      } catch {
        notice("The new snapshot is live, but the private session record could not be updated.");
      }
      return { snapshot: next.snapshot, commit: next.commit };
    })().finally(() => {
      refreshing = undefined;
    });
    return refreshing;
  };
  try {
    if (interrupted) throw new ProtoError("share_not_running");
    connection = await readConnection(runtime.connectionPath);
    if (!connection) throw new ProtoError("share_not_connected");
    client = runtime.client ?? new CloudflareClient(connection.apiToken);
    await checkConnection(connection, client);
    await cleanupSnapshots(project.root);
    if (interrupted) throw new ProtoError("share_not_running");
    const publicOrigin = `https://${connection.shellHost}`,
      renderOrigin = `https://${connection.renderHost}`;
    const first = await buildAndSwap(project, options.target, {
      remote: publicOrigin,
      approvers: options.approvers.length > 0,
      shellDir: runtime.shellDir,
    });
    if (!first.approvable)
      notice("Uncommitted changes: this version can be commented on, not approved.");
    const url = new URL(publicOrigin);
    if (options.target.kind === "prototype") url.searchParams.set("p", options.target.slug);
    if (options.target.kind === "flow") url.searchParams.set("flow", options.target.id);
    Object.assign(summary, { link: url.href, snapshot: first.snapshot, commit: first.commit });
    Object.assign(record, { url: summary.link, snapshot: first.snapshot, commit: first.commit });
    if (interrupted) throw new ProtoError("share_not_running");
    const authorized = await prefetchAccessAuthorizer({
      teamDomain: connection.teamDomain,
      audience: connection.accessAud,
      fetch: runtime.fetch,
      invitees: () =>
        invitees.map((person): Invitee => ({
          email: person.email,
          scopes: person.role === "approver" ? ["review", "comment"] : ["comment"],
        })),
    });
    const joined = new Set<string>();
    const storage = fileStorage(join(project.root, "proto/review"));
    const current = join(shareDirectory(project.root), "current");
    const keys = async () => {
      const registry = JSON.parse(
        await readFile(join(current, "__proto/registry.json"), "utf8")
      ) as Registry;
      return new Set([
        ...registry.prototypes.map(item => item.slug),
        ...registry.flows.map(item => `flow-${item.id}`),
      ]);
    };
    const handler = createReviewServer({
      storage,
      authorize: async request => {
        const identity = await authorized(request);
        if (identity && !joined.has(identity.id)) {
          joined.add(identity.id);
          runtime.activity?.({ type: "joined", email: identity.id });
        }
        return identity;
      },
      credentialOwner: async () => null,
      signIn: notInvitedPage(project.config.locale),
      gallery: { dir: current },
      publicOrigin,
      renderOrigin,
      ticketSecret: randomBytes(32).toString("hex"),
      allowSameSiteRender: true,
      restrictReviewToRegistry: true,
      disableCredentials: true,
      requireSnapshot: true,
      events,
      log: runtime.log ?? (() => {}),
    });
    const store = storage.store as FileStore;
    const seen = new Set<string>();
    const observe = async (key: string, emit: boolean) => {
      const file = await store.readFile(key);
      for (const comment of file.comments) {
        const id = `comment:${comment.id}`;
        if (
          !seen.has(id) &&
          emit &&
          comment.thread[0]?.author === "reviewer" &&
          comment.thread[0].authorId
        )
          runtime.activity?.({
            type: "commented",
            key,
            commentId: comment.id,
            email: comment.thread[0].authorId,
          });
        seen.add(id);
      }
      for (const event of file.events) {
        const id = `event:${key}:${event.id}`;
        if (
          !seen.has(id) &&
          emit &&
          event.type === "approved" &&
          event.author === "reviewer" &&
          event.authorId
        )
          runtime.activity?.({
            type: "approved",
            key,
            email: event.authorId,
            commit: event.commit,
          });
        seen.add(id);
      }
    };
    await Promise.all([...(await keys())].map(key => observe(key, false)));
    let observations = Promise.resolve();
    stopReviews = await store.subscribe(event => {
      observations = observations
        .then(async () => {
          if (stopping || !(await keys()).has(event.key)) return;
          events.publish(event);
          await observe(event.key, true);
        })
        .catch(() => {});
    });
    const sessionId = randomBytes(16).toString("hex");
    review = await serveHandler(handler, { publicOrigin, renderOrigin, sessionId });
    controlServer = createServer((request, response) => {
      const send = (status: number, value: unknown) => {
        response.writeHead(status, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        response.end(JSON.stringify(value));
      };
      if (request.headers.authorization !== `Bearer ${record.controlToken}`) {
        send(401, {});
        return;
      }
      void (async () => {
        if (request.method === "GET" && request.url === "/status") {
          const tunnel = await client!
            .tunnel(connection!.accountId, connection!.tunnelId, {
              signal: AbortSignal.timeout(runtime.statusTimeout ?? 5000),
              retry: false,
            })
            .catch(() => undefined);
          send(200, {
            running: true,
            ...summary,
            tunnel: tunnel?.connections?.length ? "healthy" : "unhealthy",
            startedAt: record.startedAt,
          });
        } else if (request.method === "POST" && request.url === "/refresh")
          send(200, await refresh());
        else if (request.method === "POST" && request.url === "/stop") {
          send(202, { stopped: true });
          void stop();
        } else send(404, {});
      })().catch(error => {
        const failure =
          error instanceof ProtoError
            ? error
            : new ProtoError("internal_error", error instanceof Error ? error.message : undefined);
        send(failure.status ?? 500, errorBody(failure));
      });
    });
    await new Promise<void>((resolve, reject) => {
      controlServer!.once("error", reject);
      controlServer!.listen(0, "127.0.0.1", resolve);
    });
    const address = controlServer.address();
    if (!address || typeof address === "string") throw new ProtoError("internal_error");
    if (interrupted) throw new ProtoError("share_not_running");
    await openInvitations(
      connection,
      invitees.map(person => person.email),
      client
    );
    await setIngress(connection, review.port, client);
    if (interrupted) throw new ProtoError("share_not_running");
    const binary = runtime.binary ?? (await locateCloudflared());
    if (interrupted) throw new ProtoError("share_not_running");
    connector = await spawnCloudflared(binary, connection.tunnelToken);
    record.cloudflaredPid = connector.pid;
    const connectorStartedAt = await systemLockEnvironment.processStartedAt(connector.pid);
    if (!connectorStartedAt) throw new ProtoError("cloudflared_unavailable");
    record.cloudflaredStartedAt = connectorStartedAt;
    await save(path, record);
    let tunnelLost = false;
    void connector.exited.then(() => {
      tunnelLost = true;
      if (!stopping) void stop(new ProtoError("share_tunnel_lost"));
    });
    const deadline = Date.now() + (runtime.readinessTimeout ?? 30_000);
    let ready = false;
    do {
      if (interrupted || stopping || tunnelLost) throw new ProtoError("share_tunnel_lost");
      try {
        const probe = runtime.fetch ?? fetch;
        const init = {
          redirect: "manual" as const,
          signal: AbortSignal.timeout(Math.max(1, Math.min(5000, deadline - Date.now()))),
        };
        const [render, shell] = await Promise.all([
          probe(`${renderOrigin}/__proto/render/`, init),
          probe(`${publicOrigin}/`, init),
        ]);
        const location = shell.headers.get("location");
        ready =
          render.status === 401 &&
          render.headers.get("X-Proto-Session") === sessionId &&
          shell.status === 302 &&
          !!location &&
          new URL(location, publicOrigin).origin === `https://${connection.teamDomain}`;
        await Promise.all([render.body?.cancel(), shell.body?.cancel()]);
      } catch {
        /* DNS and ingress may still be propagating. */
      }
      if (ready) break;
      if (Date.now() < deadline) await delay(Math.min(250, deadline - Date.now()));
    } while (Date.now() < deadline);
    if (!ready) throw new ProtoError("share_tunnel_timeout");
    if (interrupted || stopping) throw new ProtoError("share_tunnel_lost");
    record.controlPort = address.port;
    await save(path, record);
    started = true;
    return { summary, closed, refresh, stop: () => stop() };
  } catch (error) {
    await stop();
    throw error;
  }
}
