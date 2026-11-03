import { ProtoError } from "../model/errors.ts";
import type { ProtoProject } from "../node/project.ts";
// S5 replaces this module with the supervised session lifecycle.
export type ShareTarget = { kind: "prototype"; slug: string } | { kind: "flow"; id: string } | { kind: "all" };
export type ShareOptions = { target: ShareTarget; approvers: readonly string[]; commenters: readonly string[] };
export async function startShare(_project: ProtoProject, _options: ShareOptions): Promise<never> {
  throw new ProtoError("share_not_running", "Share session lifecycle is supplied by slice S5.");
}
export async function shareStatus() { return { running: false as const }; }
export async function refreshShare(): Promise<never> { throw new ProtoError("share_not_running"); }
export async function stopShare(): Promise<never> { throw new ProtoError("share_not_running"); }
export async function runningShare(): Promise<{ link: string } | null> { return null; }
