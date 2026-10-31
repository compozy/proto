import { definePrototype, type PrototypeProps } from "@proto/gallery";

import "./theme.css";
import { flow } from "./data";
import { FlowCanvas } from "./flow-canvas";
import { CommentsPanel, Inspector, StepFooter, StepPanel } from "./inspector";
import { Overview } from "./overview";
import { CompareCanvas, ScreenCanvas } from "./screen-view";
import { SearchPalette } from "./search";
import { Shell, ShellSubHeader, ShellTopBar, StatusPill } from "./shell";

export const meta = definePrototype({
  title: "Gallery shell (pink)",
  surface: "G1",
  route: "/",
  states: [
    { id: "overview", label: "Overview" },
    { id: "flow", label: "Flow · step selected" },
    { id: "flow-comments", label: "Flow · step comments" },
    { id: "screen", label: "Screen · comment thread" },
    { id: "compare", label: "Screen · light and dark" },
    { id: "search", label: "Search (⌘K)" },
  ],
});

const stepTabs = [
  { id: "step" as const, label: "Step" },
  { id: "comments" as const, label: "Comments", count: 2 },
  { id: "source" as const, label: "Source" },
];

/**
 * Draft: redesign exploration of the gallery shell itself (the future `@compozy/proto` UI),
 * after a dark workflow-canvas reference with a pink primary, built on BnUI and React Flow.
 */
export default function Prototype({ state }: PrototypeProps) {
  if (state === "overview") {
    return (
      <Shell area="overview">
        <ShellTopBar crumbs={["Overview"]} open={4} />
        <Overview />
      </Shell>
    );
  }

  if (state === "screen" || state === "compare") {
    return (
      <Shell area="screens">
        <ShellTopBar crumbs={["Authentication", "Sign in"]} open={3} />
        <ShellSubHeader
          title="Sign in"
          status={<StatusPill open={3} />}
          meta="A1 · /login · a41c9e2 · 4 min ago"
          view={state === "compare" ? "compare" : "screen"}
        />
        <div className="flex min-h-0 flex-1">
          {state === "compare" ? (
            <CompareCanvas state="error" />
          ) : (
            <ScreenCanvas state="error" active={7} tool="comment" />
          )}
          <Inspector
            title="Wrong password"
            eyebrow="State 03 · login-form"
            tab="comments"
            tabs={stepTabs}
          >
            <CommentsPanel state="error" active={state === "screen" ? 7 : undefined} />
          </Inspector>
        </div>
      </Shell>
    );
  }

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
        <FlowCanvas selected="error" />
        <Inspector
          title="Wrong password"
          eyebrow="Same screen · step 5"
          tab={comments ? "comments" : "step"}
          tabs={stepTabs}
          footer={comments ? undefined : <StepFooter />}
        >
          {comments ? <CommentsPanel state="error" active={7} /> : <StepPanel stepId="error" />}
        </Inspector>
        {state === "search" && <SearchPalette />}
      </div>
    </Shell>
  );
}
