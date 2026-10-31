import { createInterface } from "node:readline/promises";
import { HttpStore, remoteUrl } from "../store/http-store.ts";
import { readCredentials, saveCredential } from "./credentials.ts";
import { ProtoError } from "../model/errors.ts";
/** Local credential management deliberately never sends session cookies. */
export async function authCommand(
  command: string,
  url?: string,
  readToken?: () => Promise<string>
) {
  if (command === "auth credentials")
    return {
      credentials: Object.entries(await readCredentials()).map(
        ([origin, { token: _token, remote, ...value }]) => ({ remote: remote ?? origin, ...value })
      ),
    };
  const remote = remoteUrl(url || process.env.PROTO_REMOTE_URL || "");
  const settings = new URL(remote);
  settings.searchParams.set("settings", "credentials");
  if (command === "auth revoke")
    throw new ProtoError(
      "scope_denied",
      `Credentials are managed from a browser session: ${settings}`
    );
  if (command === "auth logout") {
    await saveCredential(remote.href, null);
    return { removed: true, remote: remote.href };
  }
  settings.searchParams.set("cli", "1");
  console.error(`Open ${settings}, create a credential and paste it:`);
  let token: string;
  if (readToken) token = await readToken();
  else {
    // readline does not echo piped input. On a terminal, mute output while accepting the token.
    const { Writable } = await import("node:stream");
    const muted = new Writable({
      write(_chunk, _encoding, done) {
        done();
      },
    });
    const reader = createInterface({
      input: process.stdin,
      output: muted,
      terminal: !!process.stdin.isTTY,
    });
    try {
      token = await reader.question("");
    } finally {
      reader.close();
    }
  }
  token = token.trim();
  const { principal, credential } = await new HttpStore({ url: remote.href, token }).sessionInfo();
  if (principal.kind !== "agent" || !principal.credentialId)
    throw new ProtoError("invalid_credential");
  const name = credential?.name ?? principal.name;
  await saveCredential(remote.href, {
    token,
    id: principal.credentialId,
    name,
    scopes: ["comment"],
    remote: remote.href,
  });
  return {
    saved: true,
    remote: remote.href,
    id: principal.credentialId,
    name,
    scopes: ["comment"],
  };
}
