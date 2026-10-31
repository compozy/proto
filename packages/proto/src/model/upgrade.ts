/** Pure, total legacy readers. No filesystem or registry dependencies. */
import { reviewFileSchema, type ReviewFileV3 } from "./review.ts";
export type UpgradeOptions = {
  appPrefix?: string;
  flowPrefix?: string;
  themeMap?: Record<string, string>;
  roleMap?: Record<string, string>;
};
export type Rewrite = { path: string; from: string; to: string };
export type UpgradeResult =
  | { ok: true; file: ReviewFileV3; rewrites: Rewrite[] }
  | { ok: false; issues: string[] };
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
export function upgradeReviewFile(value: unknown, options: UpgradeOptions = {}): UpgradeResult {
  try {
    if (!record(value) || !(typeof value.version === "number" && [1, 2, 3].includes(value.version)))
      return { ok: false, issues: ["Unsupported review file version"] };
    const input = structuredClone(value);
    const rewrites: Rewrite[] = [];
    const unknown: Record<string, unknown> = {};
    const rewrite = (path: string, from: string, to: string) => {
      if (from !== to) rewrites.push({ path, from, to });
      return to;
    };
    if (input.version !== 3) {
      for (const key of ["key", "review", "events"])
        if (key in input) unknown[`/${key}`] = input[key];
      const prefix = options.flowPrefix ?? "fluxo-";
      const key = String(input.slug ?? "");
      const nextKey = key.startsWith(prefix) ? `flow-${key.slice(prefix.length)}` : key;
      input.key = rewrite("key", key, nextKey);
      const comments = Array.isArray(input.comments) ? input.comments : [];
      let maximum = 0;
      for (const [i, comment] of comments.entries()) {
        if (!record(comment)) continue;
        const originalId = String(comment.id);
        comment.slug = rewrite(`comments/${i}/slug`, String(comment.slug), nextKey);
        comment.id = rewrite(
          `comments/${i}/id`,
          originalId,
          originalId.startsWith(`${key}-`) ? nextKey + originalId.slice(key.length) : originalId
        );
        const number = Number(String(comment.id).slice(nextKey.length + 1));
        if (Number.isSafeInteger(number)) maximum = Math.max(maximum, number);
        if (Array.isArray(comment.thread))
          for (const [j, message] of comment.thread.entries()) {
            if (!record(message)) continue;
            if (input.version === 1) {
              if (!("id" in message)) message.id = `legacy-${originalId}-${j}`;
              if (!("editedAt" in message)) message.editedAt = null;
              if (!("attachments" in message)) message.attachments = [];
            }
          }
        if (record(comment.context)) {
          const context = comment.context;
          if (!("commit" in context)) context.commit = null;
          // CompozyOS v2 has no role field; absence represents no selected role.
          if (!("role" in context)) context.role = null;
          for (const [field, map] of Object.entries({
            theme: options.themeMap ?? { claro: "light", escuro: "dark" },
            role: options.roleMap ?? { membro: "member" },
          })) {
            const from = context[field];
            if (typeof from === "string" && map[from])
              context[field] = rewrite(`comments/${i}/context/${field}`, from, map[from]!);
          }
        }
        if (record(comment.target)) {
          const normalize = (from: string, path: string) => {
            let to = from.replaceAll("\\", "/");
            if (options.appPrefix)
              to = to.replace(
                new RegExp(
                  `^${options.appPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\/$/, "")}/`
                ),
                ""
              );
            else to = to.replace(/^apps\/[^/]+\//, "");
            to = to.replace(/^src\/designs\//, "src/drafts/");
            return rewrite(path, from, to);
          };
          if (typeof comment.target.source === "string")
            comment.target.source = normalize(comment.target.source, `comments/${i}/target/source`);
          if (Array.isArray(comment.target.sourceChain))
            comment.target.sourceChain = comment.target.sourceChain.map((source, j) =>
              typeof source === "string"
                ? normalize(source, `comments/${i}/target/sourceChain/${j}`)
                : source
            );
        }
      }
      input.sequence = input.sequence ?? maximum;
      input.review = { status: "in_review", updatedAt: null };
      input.events = [];
      input.version = 3;
      delete input.slug;
    }
    const result = reviewFileSchema.safeParse(input);
    if (!result.success)
      return {
        ok: false,
        issues: result.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`),
      };
    // Unknown fields at any depth remain addressable by JSON pointer under the file's extra.
    function collect(raw: unknown, parsed: unknown, path: string) {
      if (Array.isArray(raw) && Array.isArray(parsed))
        raw.forEach((item, i) => collect(item, parsed[i], `${path}/${i}`));
      else if (record(raw) && record(parsed))
        for (const [key, item] of Object.entries(raw)) {
          if (!(key in parsed))
            unknown[`${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`] = item;
          else if (key !== "extra") collect(item, parsed[key], `${path}/${key}`);
        }
    }
    collect(input, result.data, "");
    if (Object.keys(unknown).length)
      result.data.extra = {
        ...result.data.extra,
        legacyUnknown: {
          ...(record(result.data.extra?.legacyUnknown) ? result.data.extra.legacyUnknown : {}),
          ...unknown,
        },
      };
    return { ok: true, file: result.data, rewrites };
  } catch {
    return { ok: false, issues: ["Invalid review file"] };
  }
}
export const readReviewFile = upgradeReviewFile;
