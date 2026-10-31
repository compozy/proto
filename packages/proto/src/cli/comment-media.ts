import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { attachmentStore, editMessage, getComment } from "../node/comments-store";
import type { CommentAttachment, ReviewComment } from "../shell/comments/model";

function messageOf(comment: ReviewComment, position?: string) {
  const index =
    position === undefined
      ? comment.thread.findLastIndex(message => message.author === "agent")
      : Number(position) - 1;
  const message = Number.isInteger(index) && index >= 0 ? comment.thread[index] : undefined;
  if (!message) throw new Error("No agent message; specify --message <number>");
  return message;
}

/** `attach`, `detach` and `attachments` of `proto comments`: images on local comment messages. */
export async function commentMedia(
  command: "attach" | "detach" | "attachments",
  id: string,
  options: {
    message?: string;
    files?: string[];
    attachment?: string;
    out?: string;
    json?: boolean;
  }
) {
  const comment = await getComment(id);
  if (command === "attachments") {
    if (!options.out) throw new Error("attachments needs --out <directory>");
    const directory = resolve(options.out);
    mkdirSync(directory, { recursive: true });
    const downloads = await Promise.all(
      comment.thread
        .flatMap((message, index) =>
          message.attachments.map(image => ({ image, message: index + 1 }))
        )
        .map(async ({ image, message }) => {
          const { bytes } = await attachmentStore(comment.slug).read(image.id);
          const file = resolve(directory, `${image.id}-${basename(image.name) || "image"}`);
          writeFileSync(file, bytes, { flag: "wx" });
          return { id: image.id, message, path: file };
        })
    );
    if (options.json) console.log(JSON.stringify(downloads));
    else for (const download of downloads) console.log(download.path);
    return;
  }
  const message =
    command === "detach"
      ? comment.thread.find(message =>
          message.attachments.some(image => image.id === options.attachment)
        )
      : messageOf(comment, options.message);
  if (!message) throw new Error("Attachment not found in this comment");
  const uploaded: CommentAttachment[] = [];
  try {
    if (command === "attach") {
      if (!options.files?.length) throw new Error("attach needs at least one image file");
      if (message.attachments.length + options.files.length > 6)
        throw new Error("attachment_limit");
      for (const path of options.files)
        uploaded.push(
          await attachmentStore(comment.slug).upload(basename(path), readFileSync(path))
        );
    }
    await editMessage(id, message.id, {
      addAttachments: uploaded.map(image => image.id),
      removeAttachments: command === "detach" ? [options.attachment!] : [],
    });
    console.log(`${command}: ${id}`);
  } catch (error) {
    // Discard only the pending uploads of this run; attached images stay with their message.
    for (const image of uploaded)
      await attachmentStore(comment.slug)
        .discard(image.id)
        .catch(() => {});
    throw error;
  }
}
