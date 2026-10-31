/**
 * The prototype view of the gallery: toolbar, the canvas with the
 * prototype in the selected state and its review comments, pinned and in the side panel.
 */
import type { ReviewComment, ElementTarget } from "./comments/model";
import { commentsApi } from "./comments/api";
import { CommentsPanel } from "./comments/panel";
import { Canvas } from "./canvas";
import type { FrameInfo } from "./frame";
import type { Entry, Group, Registry } from "./registry-model";
import { WithSidePanel } from "./side-panel";
import { GalleryToolbar } from "./toolbar";
import { frameSrc, updateView, type GalleryView } from "./view";

type PrototypeViewProps = {
  entry: Entry;
  registry: Registry;
  group: Group | undefined;
  view: GalleryView;
  state: string;
  dark: boolean;
  comments: ReviewComment[];
  frame: FrameInfo | null;
  onInfo: (info: FrameInfo | null) => void;
  picking: boolean;
  onPicking: (picking: boolean) => void;
  helpOpen: boolean;
  onHelp: (open: boolean) => void;
  onStep: (direction: 1 | -1) => void;
};

export function PrototypeView(props: PrototypeViewProps) {
  const { entry: current, registry, view, state, dark, comments, frame, picking } = props;
  const states = current.meta.states;
  const selectComment = (comment: ReviewComment | null) => {
    if (!comment) {
      updateView({ comment: null });
      return;
    }
    const { context } = comment;
    updateView({
      comment: comment.id,
      panel: true,
      state: context.state,
      theme: context.theme === "light" || context.theme === "dark" ? context.theme : null,
      role: context.role,
      width: context.viewport.width,
    });
  };

  const createComment = async (
    target: ElementTarget,
    body: string,
    viewport: { width: number; height: number },
    attachments: string[]
  ) => {
    const created = await commentsApi.create(current.slug, {
      body,
      attachments,
      target,
      context: {
        state,
        theme: view.theme ?? (dark ? "dark" : "light"),
        role: view.role,
        viewport,
      },
    });
    props.onPicking(false);
    updateView({ comment: created.id, panel: true });
  };

  return (
    <>
      <GalleryToolbar
        entry={current}
        registry={registry}
        group={props.group}
        view={view}
        state={state}
        dark={dark}
        shell={frame?.shell ?? false}
        picking={picking}
        openComments={comments.filter(comment => comment.status === "open").length}
        helpOpen={props.helpOpen}
        onHelp={props.onHelp}
        onPicking={props.onPicking}
        onStep={props.onStep}
        standaloneHref={frameSrc(current.slug, { state, theme: view.theme, role: view.role }, true)}
      />
      <WithSidePanel
        id="comments"
        label="Comments panel width"
        side={
          view.panel ? (
            <CommentsPanel
              slug={current.slug}
              kind="prototype"
              comments={comments}
              places={states}
              place={state}
              selectedId={view.comment}
              onSelect={selectComment}
              onClose={() => updateView({ panel: false, comment: null })}
            />
          ) : null
        }
      >
        <Canvas
          slug={current.slug}
          title={`${current.meta.surface} ${current.meta.title}`}
          state={state}
          theme={view.theme}
          role={view.role}
          width={view.width}
          compare={view.compare}
          picking={picking && !view.compare}
          comments={comments}
          selectedId={view.comment}
          onSelect={id => selectComment(comments.find(comment => comment.id === id) ?? null)}
          onCreate={createComment}
          onExitPicking={() => props.onPicking(false)}
          onInfo={props.onInfo}
        />
      </WithSidePanel>
    </>
  );
}
