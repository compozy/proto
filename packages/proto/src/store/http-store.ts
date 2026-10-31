import { inspectImage } from "../node/image.ts";
import { ProtoError, errors, type ErrorCode } from "../model/errors.ts";
import type {
  ReviewStore,
  Author,
  CommentFilter,
  NewComment,
  NewMessage,
  MessageChange,
  AttachmentInput,
} from "./types.ts";
export function remoteUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ProtoError("insecure_remote");
  }
  const loopback =
    url.hostname === "localhost" ||
    url.hostname === "[::1]" ||
    /^127\.(?:\d{1,3}\.){2}\d{1,3}$/.test(url.hostname);
  if (
    url.username ||
    url.password ||
    (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))
  )
    throw new ProtoError("insecure_remote");
  url.search = "";
  url.hash = "";
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}
export type HttpStoreOptions = { url: string; token: string | (() => string | Promise<string>) };
/** Bearer-only client. The author argument never crosses the wire: the server derives it. */
export class HttpStore implements ReviewStore {
  readonly url: URL;
  readonly options: HttpStoreOptions;
  constructor(options: HttpStoreOptions) {
    this.options = options;
    this.url = remoteUrl(options.url);
  }
  async request(path: string, method = "GET", body?: unknown, form?: FormData): Promise<Response> {
    const token =
      typeof this.options.token === "function" ? await this.options.token() : this.options.token;
    if (!/^pcr_[a-f0-9]{64}$/.test(token)) throw new ProtoError("invalid_credential");
    const response = await fetch(new URL(`api/${path}`, this.url), {
      method,
      redirect: "manual",
      credentials: "omit",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(form || body !== undefined ? { body: form ?? JSON.stringify(body) } : {}),
    });
    if (response.status >= 300 && response.status < 400) throw new ProtoError("redirect_refused");
    if (!response.ok) {
      let code: ErrorCode = response.status === 401 ? "auth_required" : "internal_error";
      try {
        const value = await response.json();
        if (typeof value?.error?.code === "string" && Object.hasOwn(errors, value.error.code))
          code = value.error.code;
      } catch {
        /* Never include an untrusted server body in diagnostic output. */
      }
      throw new ProtoError(code);
    }
    return response;
  }
  async sessionInfo(): Promise<{
    principal: import("../server/types.ts").Principal;
    credential?: { id: string; name: string; scopes: ["comment"] };
  }> {
    return (await this.request("session")).json();
  }
  async session() {
    return (await this.sessionInfo()).principal;
  }
  private async json(path: string, method?: string, body?: unknown) {
    return (await this.request(path, method, body)).json();
  }
  async list(filter: CommentFilter = {}) {
    return (
      await this.json(
        `comments?${new URLSearchParams(
          Object.entries(filter)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        )}`
      )
    ).comments;
  }
  async get(id: string) {
    return (await this.json(`comments/${encodeURIComponent(id)}`)).comment;
  }
  async add(key: string, input: NewComment, _author: Author) {
    return (await this.json("comments", "POST", { ...input, key })).comment;
  }
  async reply(id: string, input: NewMessage, _author: Author) {
    return (await this.json(`comments/${encodeURIComponent(id)}/replies`, "POST", input)).comment;
  }
  async setStatus(id: string, status: "open" | "resolved", _author: Author, note?: NewMessage) {
    return (await this.json(`comments/${encodeURIComponent(id)}/status`, "PATCH", { status, note }))
      .comment;
  }
  async editMessage(id: string, messageId: string, change: MessageChange, _author: Author) {
    return (
      await this.json(
        `comments/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}`,
        "PATCH",
        change
      )
    ).comment;
  }
  async remove(id: string, _author: Author) {
    await this.request(`comments/${encodeURIComponent(id)}`, "DELETE");
  }
  async upload(key: string, file: AttachmentInput, _author: Author) {
    if (file.bytes.length > 5 * 1024 * 1024) throw new ProtoError("attachment_too_large");
    let type = file.type;
    if (!type) {
      try {
        type = inspectImage(file.bytes).type;
      } catch {
        throw new ProtoError("attachment_type");
      }
    }
    const form = new FormData();
    form.set("file", new Blob([new Uint8Array(file.bytes)], { type }), file.name);
    return (
      await (
        await this.request(`attachments?key=${encodeURIComponent(key)}`, "POST", undefined, form)
      ).json()
    ).attachment;
  }
  async discard(key: string, id: string, _author: Author) {
    await this.request(
      `attachments/${encodeURIComponent(key)}/${encodeURIComponent(id)}`,
      "DELETE"
    );
  }
  async readAttachment(key: string, id: string) {
    const response = await this.request(
      `attachments/${encodeURIComponent(key)}/${encodeURIComponent(id)}`
    );
    const encoded = response.headers
      .get("content-disposition")
      ?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      type: response.headers.get("content-type") ?? "application/octet-stream",
      name: encoded ? decodeURIComponent(encoded) : "image",
    };
  }
  async review(key: string) {
    return (await this.json(`reviews/${encodeURIComponent(key)}`)).review;
  }
  async transition(
    key: string,
    to: "approved" | "in_review",
    _author: Author,
    options: { commit: string | null; confirmOpen?: boolean }
  ) {
    return (
      await this.json(`reviews/${encodeURIComponent(key)}/transitions`, "POST", {
        to,
        confirmOpen: options.confirmOpen,
      })
    ).review;
  }
  async unlock(_key: string, _options: { force: true }): Promise<never> {
    throw new ProtoError("scope_denied", "Unlock is local only.");
  }
}
