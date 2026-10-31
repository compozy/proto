/**
 * Dev-server API for review comments (`/__comments`), backed by `comments-store.ts`, and a watcher
 * that tells the gallery when a comments file changes (UI, CLI or a hand edit), over Vite's HMR
 * socket as `proto:comments`. Serve-only: it never runs in a build.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { basename, dirname } from "node:path";

import { AttachmentError } from "./attachments-store.ts";
import type { Plugin } from "vite";

import { commentsEvent, parseNewComment, type CommentAuthor } from "../shell/comments/model.ts";
import {
  addComment,
  attachmentStore,
  editMessage,
  CommentError,
  countComments,
  commentsDir,
  readComments,
  requireMessageBody,
  removeComment,
  replyTo,
  setStatus,
} from "./comments-store.ts";

const base = "/__comments";

async function readBytes(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > 5 * 1024 * 1024 + 65536) throw new AttachmentError("attachment_too_large", 413);
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}
async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks = await readBytes(request);
  const text = chunks.toString("utf8");
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new CommentError("Invalid JSON body", 400);
  }
}

function send(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

const field = (body: unknown, key: string) =>
  typeof body === "object" && body !== null ? (body as Record<string, unknown>)[key] : undefined;

const authorOf = (body: unknown): CommentAuthor =>
  field(body, "author") === "agent" ? "agent" : "reviewer";

function imageIds(body: unknown, key: string): string[] {
  const value = field(body, key);
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    !value.every(
      id => typeof id === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id)
    )
  )
    throw new CommentError("Invalid attachment ids", 400);
  return value;
}

/**
 * Routes: `GET /` counts per slug · `GET /<slug>` comments · `POST /<slug>` new comment ·
 * `POST /<slug>/<id>/replies` · `POST /<slug>/<id>/status` · `DELETE /<slug>/<id>`.
 */
async function route(request: IncomingMessage, segments: string[]) {
  const [slug, id, action] = segments;
  const method = request.method ?? "GET";
  if (slug && id === "attachments") {
    const store = attachmentStore(slug);
    if (!action && method === "POST") {
      const bytes = await readBytes(request);
      const form = await new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": request.headers["content-type"] ?? "" },
        body: new Uint8Array(bytes),
      }).formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new CommentError("Missing file", 400);
      const image = store.upload(file.name, new Uint8Array(await file.arrayBuffer()));
      return {
        status: 201,
        payload: { ...image, url: `/__comments/${slug}/attachments/${image.id}` },
      };
    }
    if (action && method === "GET") {
      const { image, bytes } = store.read(action, readComments(slug));
      return { status: 200, payload: null, bytes, type: image.type };
    }
    if (action && method === "DELETE") {
      store.discard(action);
      return { status: 204, payload: null };
    }
  }
  if (!slug) {
    if (method === "GET") return { status: 200, payload: { counts: countComments() } };
  } else if (!id) {
    if (method === "GET") return { status: 200, payload: { slug, comments: readComments(slug) } };
    if (method === "POST") {
      const input = parseNewComment(await readBody(request));
      if (!input) throw new CommentError("Invalid comment", 400);
      return { status: 201, payload: addComment(slug, input) };
    }
  } else if (!id.startsWith(`${slug}-`)) {
    throw new CommentError(`Comment "${id}" is not from "${slug}"`, 400);
  } else if (!action && method === "DELETE") {
    return { status: 200, payload: removeComment(id) };
  } else if (action === "messages" && segments[3] && segments.length === 4 && method === "PATCH") {
    const body = await readBody(request);
    return {
      status: 200,
      payload: editMessage(id, segments[3], {
        ...(field(body, "body") !== undefined
          ? { body: requireMessageBody(field(body, "body")) }
          : {}),
        addAttachments: imageIds(body, "addAttachments"),
        removeAttachments: imageIds(body, "removeAttachments"),
      }),
    };
  } else if (action === "replies" && method === "POST") {
    const body = await readBody(request);
    return {
      status: 200,
      payload: replyTo(
        id,
        authorOf(body),
        requireMessageBody(field(body, "body")),
        imageIds(body, "attachments")
      ),
    };
  } else if (action === "status" && method === "POST") {
    const body = await readBody(request);
    const status = field(body, "status");
    if (status !== "open" && status !== "resolved") throw new CommentError("Invalid status", 400);
    const note = field(body, "note");
    return {
      status: 200,
      payload: setStatus(
        id,
        status,
        note === undefined
          ? undefined
          : {
              author: authorOf(body),
              body: requireMessageBody(note),
            }
      ),
    };
  }
  return { status: 405, payload: { error: `${method} not allowed` } };
}

/** The slug of `<app>/gallery/comments/<slug>/comments.json`, or null for any other path. */
function commentedSlug(path: string) {
  if (basename(path) !== "comments.json") return null;
  const folder = dirname(path);
  return dirname(folder) === commentsDir() ? basename(folder) : null;
}

export function commentsApi(): Plugin {
  return {
    name: "gallery:comments",
    apply: "serve",
    configureServer(server) {
      const notify = (path: string) => {
        const slug = commentedSlug(path);
        if (slug) server.ws.send({ type: "custom", event: commentsEvent, data: { slug } });
      };
      server.watcher.on("add", notify);
      server.watcher.on("change", notify);
      server.watcher.on("unlink", notify);

      server.middlewares.use(base, (request, response) => {
        const path = new URL(request.url ?? "/", "http://localhost").pathname;
        const segments = path.split("/").filter(Boolean).map(decodeURIComponent);
        route(request, segments).then(
          result => {
            if ("bytes" in result && result.bytes) {
              response.setHeader("Content-Type", result.type!);
              response.setHeader("X-Content-Type-Options", "nosniff");
              response.setHeader("Cache-Control", "private, max-age=31536000, immutable");
              response.end(result.bytes);
            } else send(response, result.status, result.payload);
          },
          (error: unknown) => {
            if (error instanceof CommentError || error instanceof AttachmentError)
              send(response, error.status, { error: error.message });
            else send(response, 500, { error: String(error) });
          }
        );
      });
    },
  };
}
