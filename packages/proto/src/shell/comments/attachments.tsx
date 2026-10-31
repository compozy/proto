import type { Uploads } from "./use-attachments";
import { useState } from "react";
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@proto/ui/components/attachment";
import { Button } from "@proto/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@proto/ui/components/dialog";
import type { CommentAttachment } from "./model";

export function AttachmentInput({
  uploads,
  capacity = 6,
  disabled = false,
}: {
  uploads: Uploads;
  capacity?: number;
  disabled?: boolean;
}) {
  const [limit, setLimit] = useState(false);
  function accept(files: File[]) {
    setLimit(uploads.items.length + files.length > capacity);
    uploads.add(files, capacity);
  }
  return (
    <div
      className="grid gap-2"
      onPaste={event => {
        if (disabled || !event.clipboardData.files.length) return;
        event.preventDefault();
        accept([...event.clipboardData.files]);
      }}
      onDragOver={event => {
        if (!disabled) event.preventDefault();
      }}
      onDrop={event => {
        event.preventDefault();
        if (!disabled) accept([...event.dataTransfer.files]);
      }}
      tabIndex={0}
      aria-label="Paste or drop images here"
    >
      <label className="cursor-pointer text-xs underline underline-offset-4">
        Attach image
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          disabled={disabled}
          className="sr-only"
          onChange={event => {
            accept([...(event.target.files ?? [])]);
            event.target.value = "";
          }}
        />
      </label>
      <p className="text-[11px] text-muted-foreground">
        Paste or drop here. Up to 6 images of 5 MB.
      </p>
      {limit ? (
        <p role="alert" className="text-xs text-destructive">
          6 images per message at most.
        </p>
      ) : null}
      <AttachmentGroup>
        {uploads.items.map(item => (
          <Attachment
            key={item.key}
            orientation="vertical"
            state={item.error ? "error" : item.image ? "done" : "uploading"}
          >
            <AttachmentMedia variant="image">
              <img src={item.preview} alt={item.file.name} />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>{item.file.name}</AttachmentTitle>
              <AttachmentDescription>
                {item.error ?? (item.image ? "Ready" : `${item.progress}%`)}
              </AttachmentDescription>
            </AttachmentContent>
            {item.error ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled}
                onClick={() => uploads.retry(item)}
              >
                Try again
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() => uploads.remove(item.key)}
            >
              Remove
            </Button>
          </Attachment>
        ))}
      </AttachmentGroup>
    </div>
  );
}

export function AttachmentImages({ images }: { images: CommentAttachment[] }) {
  return (
    <AttachmentGroup>
      {images.map(image => (
        <Dialog key={image.id}>
          <Attachment orientation="vertical">
            <DialogTrigger className="text-left" aria-label={`Open image ${image.name}`}>
              <AttachmentMedia variant="image">
                <img src={image.url} width={image.width} height={image.height} alt={image.name} />
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>{image.name}</AttachmentTitle>
              </AttachmentContent>
            </DialogTrigger>
          </Attachment>
          <DialogContent className="max-w-[95vw] sm:max-w-[95vw]">
            <DialogHeader>
              <DialogTitle>{image.name}</DialogTitle>
            </DialogHeader>
            <img src={image.url} alt={image.name} className="max-h-[80vh] w-full object-contain" />
          </DialogContent>
        </Dialog>
      ))}
    </AttachmentGroup>
  );
}
