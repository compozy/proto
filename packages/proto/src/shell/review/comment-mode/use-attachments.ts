/**
 * Pending image uploads of one composer: each image is uploaded at once as a pending attachment
 * of the review key (`POST attachments?key=`), claimed by id when the message is sent, and
 * discarded (`DELETE attachments/:key/:id`) when it is removed, the composer is cancelled or it
 * unmounts unsent. Limits mirror the error registry: 5 MB, PNG/JPEG/WebP/GIF, 6 per message.
 */
import { useEffect, useRef, useState } from "react";

import type { PendingAttachment, ReviewApi } from "../api";

export const maxImages = 6;
export const maxBytes = 5 * 1024 * 1024;
export const imageTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export type UploadProblem =
  | "attachment_too_large"
  | "attachment_type"
  | "attachment_limit"
  | "attachment_expired"
  | "upload_failed";

export type Upload = {
  id: string;
  name: string;
  size: number;
  preview: string;
  status: "uploading" | "ready" | "failed";
  attachment: PendingAttachment | null;
  problem: UploadProblem | null;
};

type Refusal = { name: string; size: number; problem: UploadProblem };

const codeOf = (error: unknown) =>
  error && typeof error === "object" && "code" in error ? String(error.code) : "";

function problemOf(error: unknown): UploadProblem {
  const code = codeOf(error);
  return code === "attachment_too_large" ||
    code === "attachment_type" ||
    code === "attachment_limit" ||
    code === "attachment_expired"
    ? code
    : "upload_failed";
}

let counter = 0;

export function useAttachments(api: Pick<ReviewApi, "upload" | "discard">, key: string) {
  const [items, setItems] = useState<Upload[]>([]);
  const [refused, setRefused] = useState<Refusal | null>(null);
  const live = useRef(new Map<string, Upload>());
  const sent = useRef(false);

  const publish = () => setItems([...live.current.values()].map(item => ({ ...item })));

  // Unsent uploads never outlive the composer.
  useEffect(() => {
    const uploads = live.current;
    return () => {
      for (const item of uploads.values()) {
        URL.revokeObjectURL(item.preview);
        if (!sent.current && item.attachment)
          void api.discard(key, item.attachment.id).catch(() => {});
      }
      uploads.clear();
    };
  }, [api, key]);

  const upload = (item: Upload, file: File) => {
    item.status = "uploading";
    item.problem = null;
    publish();
    api.upload(key, file, file.name).then(
      attachment => {
        if (!live.current.has(item.id)) {
          void api.discard(key, attachment.id).catch(() => {});
          return;
        }
        item.attachment = attachment;
        item.status = "ready";
        publish();
      },
      (error: unknown) => {
        item.status = "failed";
        item.problem = problemOf(error);
        publish();
      }
    );
  };

  const add = (files: readonly File[]) => {
    setRefused(null);
    for (const file of files) {
      if (live.current.size >= maxImages) {
        setRefused({ name: file.name, size: file.size, problem: "attachment_limit" });
        break;
      }
      if (!imageTypes.includes(file.type)) {
        setRefused({ name: file.name, size: file.size, problem: "attachment_type" });
        continue;
      }
      if (file.size > maxBytes) {
        setRefused({ name: file.name, size: file.size, problem: "attachment_too_large" });
        continue;
      }
      counter += 1;
      const item: Upload = {
        id: `upload-${counter}`,
        name: file.name,
        size: file.size,
        preview: URL.createObjectURL(file),
        status: "uploading",
        attachment: null,
        problem: null,
      };
      live.current.set(item.id, item);
      upload(item, file);
    }
    publish();
  };

  const remove = (id: string) => {
    const item = live.current.get(id);
    if (!item) return;
    live.current.delete(id);
    URL.revokeObjectURL(item.preview);
    if (item.attachment) void api.discard(key, item.attachment.id).catch(() => {});
    publish();
  };

  return {
    items,
    refused,
    add,
    remove,
    /** Every image uploaded and none failed: the message can be sent. */
    ready: items.every(item => item.status === "ready"),
    ids: items.flatMap(item => (item.attachment ? [item.attachment.id] : [])),
    /** The message was stored with these attachments: keep them on unmount. */
    claimed: () => {
      sent.current = true;
    },
  };
}
