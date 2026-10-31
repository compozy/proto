import { cn } from "@proto/ui/lib/utils";
import { commentNumber, type Rect, type ReviewComment } from "./model";
export type Located = { rect: Rect; anchored: boolean };
export function CommentPins({
  comments,
  located,
  scale,
  width,
  height,
  selectedId,
  onSelect,
}: {
  comments: ReviewComment[];
  located: Map<string, Located>;
  scale: number;
  width: number;
  height: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <>
      {comments.map(comment => {
        const spot = located.get(comment.id);
        if (!spot) return null;
        const left = Math.min(
          Math.max((spot.rect.x + spot.rect.width) * scale - 12, 4),
          width - 28
        );
        const top = Math.min(Math.max(spot.rect.y * scale - 12, 4), height - 28);
        const selected = comment.id === selectedId;
        return (
          <button
            key={comment.id}
            type="button"
            onPointerDown={event => event.stopPropagation()}
            onClick={() => onSelect(selected ? null : comment.id)}
            className={cn(
              "pointer-events-auto absolute grid size-6 place-items-center rounded-full font-mono text-[11px] font-medium tabular-nums transition-transform duration-150 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              comment.status === "open"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
              selected && "scale-110 ring-2 ring-primary-foreground",
              !spot.anchored && "opacity-70"
            )}
            style={{ left, top }}
            aria-label={`Comment ${commentNumber(comment)}${spot.anchored ? "" : " (anchor not found)"}`}
            title={comment.thread[0]?.body}
          >
            {commentNumber(comment)}
          </button>
        );
      })}
    </>
  );
}
