import { emitKeypressEvents } from "node:readline";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { ProtoError } from "../model/errors.ts";
import { loadProject, type ProtoProject } from "../node/project.ts";
import { projectRoot } from "../cli/main.ts";
import { connect, disconnect, readConnection } from "./connection.ts";
import { startShare, shareStatus, refreshShare, stopShare, runningShare, type ShareOptions, type ShareRuntime } from "./session.ts";

const verbs = ["connect", "disconnect", "status", "refresh", "stop"] as const;
export type ShareArguments = {
  command: "start" | typeof verbs[number]; app?: string; name?: string; domain?: string;
  json: boolean; options?: ShareOptions;
};
export function parseShareArgs(argv: readonly string[]): ShareArguments {
  const strings = new Set(["slug", "flow", "name", "domain", "app", "approver", "commenter"]);
  const values: Record<string, string[]> = {};
  const words: string[] = [];
  let all = false, json = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) { words.push(arg); continue; }
    const [key, ...parts] = arg.slice(2).split("=");
    if (key === "all" || key === "json") {
      if (parts.length || (key === "all" && all)) throw new ProtoError("invalid_input", `Invalid --${key}.`);
      if (key === "all") all = true; else json = true;
      continue;
    }
    if (!strings.has(key!)) throw new ProtoError("invalid_input", `Unknown option --${key}.`);
    const value = parts.length ? parts.join("=") : argv[++i];
    if (!value || value.startsWith("--")) throw new ProtoError("invalid_input", `--${key} needs a value.`);
    if (values[key!]?.length && key !== "approver" && key !== "commenter") throw new ProtoError("invalid_input", `Repeated --${key}.`);
    (values[key!] ??= []).push(value);
  }
  const command = verbs.find(verb => verb === words[0]) ?? "start";
  const result: ShareArguments = { command, json, app: values.app?.[0], name: values.name?.[0], domain: values.domain?.[0] };
  if (command !== "start") {
    const allowed = command === "connect" ? ["name", "domain", "app"] : ["app"];
    if (words.length !== 1 || all || Object.keys(values).some(key => !allowed.includes(key))) throw new ProtoError("invalid_input", `Invalid arguments for share ${command}.`);
    return result;
  }
  if (values.name || values.domain) throw new ProtoError("invalid_input", "--name and --domain are connect options.");
  if (words.length + Number(!!values.slug) + Number(!!values.flow) + Number(all) !== 1) throw new ProtoError("share_target_required");
  const normalize = (emails: string[]) => [...new Set(emails.map(email => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ProtoError("invalid_input", `Invalid email: ${email}.`);
    return email.toLowerCase();
  }))];
  const approvers = normalize(values.approver ?? []);
  const commenters = normalize(values.commenter ?? []).filter(email => !approvers.includes(email));
  if (!approvers.length && !commenters.length) throw new ProtoError("share_no_invitees");
  result.options = {
    target: all ? { kind: "all" } : values.flow ? { kind: "flow", id: values.flow[0]! } : { kind: "prototype", slug: values.slug?.[0] ?? words[0]! },
    approvers, commenters,
  };
  return result;
}
async function readToken() {
  console.error("Paste a Cloudflare API token:");
  const reader = createInterface({ input: process.stdin, output: new Writable({ write(_chunk, _encoding, done) { done(); } }), terminal: !!process.stdin.isTTY });
  try { return (await reader.question("")).trim(); } finally { reader.close(); }
}
async function choose(kind: string, choices: readonly { id: string; name: string }[]) {
  if (!process.stdin.isTTY) throw new ProtoError("invalid_input", `Select a ${kind} interactively or use --domain.`);
  const reader = createInterface({ input: process.stdin, output: process.stderr });
  try {
    choices.forEach((item, i) => console.error(`${i + 1}. ${item.name}`));
    const index = Number(await reader.question(`Choose ${kind}: `)) - 1;
    if (!Number.isInteger(index) || !choices[index]) throw new ProtoError("invalid_input");
    return choices[index]!.id;
  } finally { reader.close(); }
}
export async function shareCommand(argv: readonly string[], options: { cwd?: string; project?: ProtoProject; readToken?: () => Promise<string>; share?: ShareRuntime }) {
  const args = parseShareArgs(argv);
  if (args.command === "connect") return connect({ apiToken: (process.env.CLOUDFLARE_API_TOKEN || await (options.readToken ?? readToken)()).trim(), name: args.name, domain: args.domain, cwd: options.cwd, choose, path: options.share?.connectionPath, client: options.share?.client });
  if (args.command === "disconnect") return disconnect({ path: options.share?.connectionPath, client: options.share?.client, running: () => runningShare(options.share) });
  if (args.command === "status") return shareStatus(options.share);
  if (args.command === "refresh") return refreshShare(options.share);
  if (args.command === "stop") return stopShare(options.share);
  if (!await readConnection(options.share?.connectionPath)) throw new ProtoError("share_not_connected");
  const project = options.project ?? await loadProject(projectRoot(options.cwd ?? process.cwd(), args.app));
  const session = await startShare(project, args.options!, {
    ...options.share,
    notice: message => { options.share?.notice?.(message); if (!args.json) console.error(`! ${message}`); },
    activity: event => {
      options.share?.activity?.(event);
      if (args.json) return;
      if (event.type === "joined") console.error(`${event.email} joined`);
      if (event.type === "commented") console.error(`${event.email} commented on ${event.key} (${event.commentId})`);
      if (event.type === "approved") console.error(`${event.email} approved ${event.key} at ${event.commit?.slice(0, 7) ?? "—"}`);
    },
  });
  if (process.stdin.isTTY) {
    const wasRaw = process.stdin.isRaw;
    emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const keypress = (_text: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === "c") process.kill(process.pid, "SIGINT");
      else if (key.name === "r") void session.refresh().then(result => {
        if (!args.json) console.error(`✓ Snapshot ${result.snapshot.slice(0, 7)}`);
      }).catch(error => { if (!args.json) console.error(error instanceof Error ? error.message : "Refresh failed"); });
    };
    process.stdin.on("keypress", keypress);
    void session.closed.then(() => {
      process.stdin.removeListener("keypress", keypress);
      process.stdin.setRawMode(!!wasRaw);
      process.stdin.pause();
    });
  }
  return session;
}
