import { z } from "zod";
import { errorBody, ProtoError } from "../model/errors.ts";
import {
  commentFilterSchema,
  keySchema,
  messageChangeSchema,
  newCommentSchema,
  newMessageSchema,
} from "../model/review.ts";
import type { Registry } from "../model/registry.ts";
import { confineSource, sourceRoots, type SourceRoots } from "../model/source.ts";
import type { ReviewStore } from "../store/types.ts";
import { ReviewEvents } from "./events.ts";
import type { ReviewAuthorizer, ReviewOperation } from "./authorization.ts";
export type ReviewRouterOptions = {
  store: ReviewStore;
  registry: () => Registry | Promise<Registry>;
  authorize: ReviewAuthorizer;
  events?: ReviewEvents;
  basePath?: string;
  roots?: SourceRoots;
  commit?: () => string | null | Promise<string | null>;
};
const json = (value: unknown, status = 200) => Response.json(value, { status });
async function boundedBody(request: Request) {
  const limit = 5 * 1024 * 1024 + 65536;
  if (Number(request.headers.get("content-length")) > limit)
    throw new ProtoError("attachment_too_large");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > limit) {
        await reader.cancel();
        throw new ProtoError("attachment_too_large");
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
async function body(request: Request): Promise<unknown> {
  try {
    return JSON.parse(new TextDecoder().decode(await boundedBody(request)));
  } catch (error) {
    if (error instanceof ProtoError) throw error;
    throw new ProtoError("invalid_input", "Invalid JSON body.");
  }
}
export function createReviewRouter(
  options: ReviewRouterOptions
): (request: Request) => Promise<Response> {
  const base = (options.basePath ?? "/__proto/api").replace(/\/$/, "");
  const events = options.events ?? new ReviewEvents();
  const changed = (key: string, review = false) => {
    events.publish({ type: "comments", key });
    if (review) events.publish({ type: "review", key });
  };
  return async request => {
    try {
      const url = new URL(request.url),
        method = request.method;
      const path = url.pathname.startsWith(`${base}/`) ? url.pathname.slice(base.length + 1) : "";
      const [resource, id, action, messageId, ...rest] = path.split("/").map(decodeURIComponent);
      const operation: ReviewOperation =
        method === "GET" || method === "HEAD"
          ? "read"
          : resource === "reviews"
            ? "review"
            : resource === "comments" && method === "DELETE"
              ? "delete"
              : action === "messages" || (resource === "attachments" && method === "DELETE")
                ? "edit"
                : "comment";
      const authorization = await options.authorize(request, operation);
      if (authorization instanceof Response) return authorization;
      const { author } = authorization;
      const store = options.store;
      if (rest.length) throw new ProtoError("comment_not_found");
      if (resource === "registry" && !id && method === "GET") return json(await options.registry());
      if (resource === "events" && !id && method === "GET") return events.response(request.signal);
      if (resource === "comments") {
        if (!id && method === "GET") {
          const query: Record<string, unknown> = Object.fromEntries(url.searchParams);
          if (query.waiting !== undefined) {
            if (query.waiting !== "true" && query.waiting !== "false")
              throw new ProtoError("invalid_input");
            query.waiting = query.waiting === "true";
          }
          return json({ comments: await store.list(commentFilterSchema.parse(query)) });
        }
        if (!id && method === "POST") {
          const input = newCommentSchema.extend({ key: keySchema }).parse(await body(request));
          const registry = await options.registry();
          if (
            !registry.prototypes.some(item => item.slug === input.key) &&
            !registry.flows.some(item => `flow-${item.id}` === input.key)
          )
            throw new ProtoError("comment_not_found");
          if (input.target.kind !== "node") {
            const roots = options.roots ?? sourceRoots();
            if (input.target.source !== null) confineSource(input.target.source, roots);
            for (const source of input.target.sourceChain) confineSource(source, roots);
          }
          const comment = await store.add(input.key, input, author);
          changed(input.key, true);
          return json({ comment }, 201);
        }
        if (id && !action && method === "GET") return json({ comment: await store.get(id) });
        if (id && !action && method === "DELETE") {
          const comment = await store.get(id);
          await store.remove(id, author);
          changed(comment.slug, true);
          return new Response(null, { status: 204 });
        }
        if (id && action === "replies" && !messageId && method === "POST") {
          const comment = await store.reply(
            id,
            newMessageSchema.parse(await body(request)),
            author
          );
          changed(comment.slug);
          return json({ comment }, 201);
        }
        if (id && action === "status" && !messageId && method === "PATCH") {
          const input = z
            .object({
              status: z.enum(["open", "resolved"]),
              note: z.union([z.string().trim().min(1).max(10000), newMessageSchema]).optional(),
            })
            .parse(await body(request));
          const comment = await store.setStatus(
            id,
            input.status,
            author,
            typeof input.note === "string" ? { body: input.note } : input.note
          );
          changed(comment.slug, true);
          return json({ comment });
        }
        if (id && action === "messages" && messageId && method === "PATCH") {
          const comment = await store.editMessage(
            id,
            messageId,
            messageChangeSchema.parse(await body(request)),
            author
          );
          changed(comment.slug);
          return json({ comment });
        }
      }
      if (resource === "attachments") {
        if (!id && method === "POST") {
          const key = keySchema.parse(url.searchParams.get("key"));
          const bytes = await boundedBody(request);
          let form: FormData;
          try {
            form = await new Response(bytes, {
              headers: { "Content-Type": request.headers.get("content-type") ?? "" },
            }).formData();
          } catch {
            throw new ProtoError("invalid_input", "Expected multipart file.");
          }
          const file = form.get("file");
          if (!file || typeof file === "string")
            throw new ProtoError("invalid_input", "Missing file.");
          return json(
            {
              attachment: await store.upload(
                key,
                {
                  name: file.name,
                  type: file.type,
                  bytes: new Uint8Array(await file.arrayBuffer()),
                },
                author
              ),
            },
            201
          );
        }
        if (id && action && !messageId && method === "DELETE") {
          await store.discard(id, action, author);
          return new Response(null, { status: 204 });
        }
        if (id && action && !messageId && method === "GET") {
          const image = await store.readAttachment(id, action);
          return new Response(new Uint8Array(image.bytes), {
            headers: {
              "Content-Type": image.type,
              "Content-Disposition": `attachment; filename="image"; filename*=UTF-8''${encodeURIComponent(image.name).replaceAll("'", "%27")}`,
              "X-Content-Type-Options": "nosniff",
              "Content-Security-Policy": "default-src 'none'",
              "Cache-Control": "private, no-store",
            },
          });
        }
      }
      if (resource === "reviews" && id) {
        if (!action && method === "GET") return json({ review: await store.review(id) });
        if (action === "transitions" && !messageId && method === "POST") {
          const input = z
            .object({ to: z.enum(["approved", "in_review"]), confirmOpen: z.boolean().optional() })
            .parse(await body(request));
          const review = await store.transition(id, input.to, author, {
            commit: (await options.commit?.()) ?? null,
            confirmOpen: input.confirmOpen,
          });
          events.publish({ type: "review", key: id });
          return json({ review });
        }
      }
      throw new ProtoError("comment_not_found", "Review endpoint not found.");
    } catch (error) {
      const failure =
        error instanceof ProtoError
          ? error
          : error instanceof z.ZodError || error instanceof URIError
            ? new ProtoError("invalid_input")
            : new ProtoError("internal_error");
      return json(errorBody(failure), failure.status ?? 500);
    }
  };
}
