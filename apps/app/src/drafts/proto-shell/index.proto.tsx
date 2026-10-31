import { definePrototype, type PrototypeProps } from "@compozy/proto";

import "./theme.css";
import { flow } from "./data";
import { FlowCanvas } from "./flow-canvas";
import { Inbox } from "./inbox";
import { CommentsPanel, FlowSummaryPanel, Inspector, StepFooter, StepPanel } from "./inspector";
import {
  ApproveDialog,
  ComposeHint,
  ComposeOverlay,
  RenderErrorCanvas,
  ShortcutsSheet,
} from "./overlays";
import { Overview } from "./overview";
import { Drafts, EmptyGallery, SignInPage } from "./pages";
import { CompareCanvas, ScreenCanvas } from "./screen-view";
import { SearchPalette } from "./search";
import { Settings } from "./settings";
import { Shell, ShellSubHeader, ShellTopBar, StatusPill } from "./shell";
import { SpecPage } from "./spec-page";

/**
 * Visual contract of the `@compozy/proto` shell (`_uiux.md` S1–S21 in ~/Dev/compozy/proto). Each
 * state names the surface it is the contract for.
 */
export const meta = definePrototype({
  title: "Gallery shell (pink)",
  surface: "G1",
  route: "/",
  states: [
    { id: "overview", label: "S2 · Overview" },
    { id: "spec", label: "S3 · Spec page" },
    { id: "flow-summary", label: "S4 · Flow, nothing selected" },
    { id: "flow", label: "S4/S5 · Flow, step selected" },
    { id: "flow-comments", label: "S9 · Flow, step comments" },
    { id: "screen", label: "S6/S9 · Screen, thread focused" },
    { id: "state-picker", label: "S6 · State picker open" },
    { id: "comment-compose", label: "S8 · Comment mode, composer" },
    { id: "compare", label: "S7 · Compare light and dark" },
    { id: "approve", label: "S10 · Approve with open comments" },
    { id: "approved", label: "S10 · Approved" },
    { id: "inbox", label: "S11 · Comments inbox" },
    { id: "drafts", label: "S12 · Drafts" },
    { id: "search", label: "S13 · Search (⌘K)" },
    { id: "empty", label: "S14 · First run" },
    { id: "problems", label: "S15 · Problems (Health)" },
    { id: "render-error", label: "S16 · Render failure" },
    { id: "settings", label: "S17 · Settings, credentials" },
    { id: "sign-in", label: "S18 · Remote sign-in" },
    { id: "shortcuts", label: "S19 · Shortcuts" },
    { id: "drawer", label: "S20 · Narrow, inspector drawer" },
    { id: "read-only", label: "S21 · Read-only build" },
  ],
});

const stepTabs = [
  { id: "step" as const, label: "Step" },
  { id: "comments" as const, label: "Comments", count: 2 },
  { id: "source" as const, label: "Source" },
];

const screenTabs = [
  { id: "step" as const, label: "State" },
  { id: "comments" as const, label: "Comments", count: 2 },
  { id: "source" as const, label: "Source" },
];

/** Draft: the gallery shell redesign, built with BnUI and React Flow on the real gallery. */
export default function Prototype({ state }: PrototypeProps) {
  switch (state) {
    case "overview":
    case "shortcuts":
      return (
        <Shell area="overview">
          <ShellTopBar crumbs={["Overview"]} open={4} actions={false} />
          <Overview />
          {state === "shortcuts" && <ShortcutsSheet />}
        </Shell>
      );
    case "spec":
      return (
        <Shell area="overview">
          <ShellTopBar crumbs={["Authentication"]} open={3} actions={false} />
          <ShellSubHeader
            title="Authentication"
            status={<StatusPill open={3} />}
            meta="auth · 1 flow · 2 screens · 6 states"
          />
          <SpecPage />
        </Shell>
      );
    case "empty":
      return (
        <Shell area="overview">
          <ShellTopBar crumbs={["Overview"]} open={0} actions={false} />
          <EmptyGallery />
        </Shell>
      );
    case "drafts":
      return (
        <Shell area="drafts">
          <ShellTopBar crumbs={["Drafts"]} open={4} actions={false} />
          <Drafts />
        </Shell>
      );
    case "inbox":
      return (
        <Shell area="comments">
          <ShellTopBar crumbs={["Comments"]} open={5} actions={false} />
          <ShellSubHeader
            title="Comments"
            status={<StatusPill open={5} />}
            meta="2 waiting for you · 3 specs"
          />
          <Inbox selected={0} />
        </Shell>
      );
    case "settings":
    case "problems":
      return (
        <Shell area="settings">
          <ShellTopBar
            crumbs={["Settings"]}
            open={4}
            problems={state === "problems" ? 2 : 0}
            actions={false}
          />
          <Settings section={state === "problems" ? "health" : "credentials"} />
        </Shell>
      );
    case "sign-in":
      return <SignInPage />;
    case "screen":
    case "state-picker":
    case "comment-compose":
    case "compare":
    case "approve":
    case "approved":
    case "render-error":
    case "drawer":
    case "read-only":
      return <ScreenState state={state} />;
    default:
      return <FlowState state={state} />;
  }
}

function ScreenState({ state }: { state: string }) {
  const approved = state === "approved";
  const readOnly = state === "read-only";
  const canvas =
    state === "compare" ? (
      <CompareCanvas state="error" />
    ) : state === "render-error" ? (
      <RenderErrorCanvas />
    ) : state === "comment-compose" ? (
      <ScreenCanvas state="error" tool="comment" extra={<ComposeOverlay />} />
    ) : (
      <ScreenCanvas
        state="error"
        pickerOpen={state === "state-picker"}
        active={state === "screen" || state === "drawer" ? 7 : undefined}
        tool={readOnly ? null : "select"}
      />
    );
  return (
    <Shell area="screens">
      <ShellTopBar
        crumbs={["Authentication", "Sign in"]}
        open={3}
        approved={approved}
        readOnly={readOnly}
      />
      <ShellSubHeader
        title="Sign in"
        status={readOnly ? undefined : <StatusPill open={2} approved={approved} />}
        meta={
          approved
            ? "Approved by Pedro Nauck · a41c9e2 · 2 open recorded"
            : "A1 · /login · a41c9e2 · 4 min ago"
        }
        view={state === "compare" ? "compare" : "screen"}
      />
      <div className="relative flex min-h-0 flex-1">
        {canvas}
        {state === "comment-compose" && <ComposeHint />}
        <Inspector
          title={state === "render-error" ? "Submitting" : "Wrong password"}
          eyebrow={state === "render-error" ? "State 04 · login-form" : "State 03 · login-form"}
          tab="comments"
          tabs={screenTabs}
          drawer={state === "drawer"}
        >
          <CommentsPanel
            state={state === "render-error" ? "pending" : "error"}
            active={state === "screen" || state === "drawer" ? 7 : undefined}
            readOnly={readOnly}
          />
        </Inspector>
      </div>
      {state === "approve" && <ApproveDialog />}
    </Shell>
  );
}

function FlowState({ state }: { state: string }) {
  const summary = state === "flow-summary";
  const comments = state === "flow-comments";
  return (
    <Shell area="flows">
      <ShellTopBar crumbs={["Authentication", "Flows", flow.title]} open={3} />
      <ShellSubHeader
        title={`${flow.title} journey`}
        status={<StatusPill open={3} />}
        meta="6 steps · a41c9e2 · 4 min ago"
        view="flow"
      />
      <div className="relative flex min-h-0 flex-1">
        <FlowCanvas selected={summary ? undefined : "error"} />
        {summary ? (
          <Inspector
            title={`${flow.title} journey`}
            eyebrow="Flow · auth"
            tab="step"
            tabs={[
              { id: "step", label: "Flow" },
              { id: "comments", label: "Comments", count: 1 },
            ]}
          >
            <FlowSummaryPanel />
          </Inspector>
        ) : (
          <Inspector
            title="Wrong password"
            eyebrow="Same screen · step 5"
            tab={comments ? "comments" : "step"}
            tabs={stepTabs}
            footer={comments ? undefined : <StepFooter />}
          >
            {comments ? <CommentsPanel state="error" active={7} /> : <StepPanel stepId="error" />}
          </Inspector>
        )}
        {state === "search" && <SearchPalette />}
      </div>
    </Shell>
  );
}
