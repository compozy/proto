import { useEffect, useRef, useState } from "react";
import type { CommentAttachment } from "./model";

/** The dev server's attachment endpoint (`node/comments-plugin.ts`). */
const attachmentsBase = (slug: string) => `/__comments/${slug}/attachments`;
const discard = (slug: string, id: string) =>
  fetch(`${attachmentsBase(slug)}/${id}`, { method: "DELETE" }).catch(() => undefined);
type Upload = {
  key: string;
  file: File;
  preview: string;
  progress: number;
  image?: CommentAttachment;
  error?: string;
};

/** Pending uploads survive retries; removed or late uploads are discarded even after unmount. */
export function useAttachments(slug: string) {
  const [items, setItems] = useState<Upload[]>([]);
  const active = useRef(false);
  const pending = useRef(new Map<string, Upload>());
  useEffect(() => {
    active.current = true;
    const uploads = pending.current;
    return () => {
      active.current = false;
      for (const item of uploads.values()) {
        URL.revokeObjectURL(item.preview);
        if (item.image) void discard(slug, item.image.id);
      }
      uploads.clear();
    };
  }, [slug]);
  function publish() {
    if (active.current) setItems([...pending.current.values()].map(item => ({ ...item })));
  }
  function upload(previous: Upload) {
    const item = { ...previous, error: undefined, progress: 0 } as Upload;
    pending.current.set(item.key, item);
    const form = new FormData();
    form.set("file", item.file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", attachmentsBase(slug));
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) {
        item.progress = Math.round((event.loaded / event.total) * 100);
        publish();
      }
    };
    xhr.onerror = () => {
      item.error = "Upload failed. Try again.";
      publish();
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        item.error =
          xhr.status === 413
            ? "Images must be 5 MB or less."
            : "Send a valid PNG, JPEG, WebP or GIF image.";
        publish();
        return;
      }
      let image: CommentAttachment;
      try {
        image = JSON.parse(xhr.responseText) as CommentAttachment;
      } catch {
        item.error = "Invalid response. Try again.";
        publish();
        return;
      }
      if (!active.current || !pending.current.has(item.key)) {
        void discard(slug, image.id);
        return;
      }
      item.image = image;
      item.progress = 100;
      publish();
    };
    xhr.send(form);
    publish();
  }
  function add(files: File[], capacity = 6) {
    for (const file of files.slice(0, Math.max(0, capacity - pending.current.size))) {
      const item: Upload = {
        key: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        progress: 0,
      };
      pending.current.set(item.key, item);
      if (file.size > 5 * 1024 * 1024) {
        item.error = "Images must be 5 MB or less.";
        publish();
      } else upload(item);
    }
  }
  function remove(key: string) {
    const item = pending.current.get(key);
    if (!item) return;
    pending.current.delete(key);
    URL.revokeObjectURL(item.preview);
    if (item.image) void discard(slug, item.image.id);
    publish();
  }
  function committed() {
    for (const item of pending.current.values()) URL.revokeObjectURL(item.preview);
    pending.current.clear();
    publish();
  }
  return {
    items,
    add,
    remove,
    retry: upload,
    committed,
    cancel: () => {
      for (const key of pending.current.keys()) remove(key);
    },
    ids: items.flatMap(item => (item.image ? [item.image.id] : [])),
    ready: items.every(item => !!item.image),
  };
}
export type Uploads = ReturnType<typeof useAttachments>;
