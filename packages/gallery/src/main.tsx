import { Component, StrictMode, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { config, PresentationCanvas, PrototypeFrame } from "virtual:gallery-app";

import { TooltipProvider } from "@proto/ui/components/tooltip";

import { useSearch } from "./contract";
import { ThemeProvider } from "./render/theme";
import { PrototypeToolbar } from "./render/toolbar";
import { frameStatusType, postFrameStatus } from "./shell/frame-status";
import { Gallery } from "./shell/gallery";
import { kindFor, loaderFor, type PrototypeModule } from "./shell/registry";
import { resolvePrototypeRole } from "./shell/view";

type Loaded = { slug: string; module?: PrototypeModule; error?: string };

function usePrototype(slug: string) {
  const [result, setResult] = useState<Loaded | null>(null);
  useEffect(() => {
    const loader = loaderFor(slug);
    if (!loader) return;
    loader().then(
      module => setResult({ slug, module }),
      (error: unknown) => {
        const message = String(error);
        setResult({ slug, error: message });
        postFrameStatus({ type: frameStatusType, status: "error", slug, message });
      }
    );
  }, [slug]);
  return result?.slug === slug ? result : null;
}

/** Tells the embedding gallery frame that the prototype committed its first render. */
function ReportReady({ slug, state }: { slug: string; state: string }) {
  useEffect(() => {
    postFrameStatus({ type: frameStatusType, status: "ready", slug, state });
  }, [slug, state]);
  return null;
}

type BoundaryProps = { slug: string; children: ReactNode };

/** A prototype that throws while rendering shows the error and reports it to the gallery. */
class PrototypeBoundary extends Component<BoundaryProps, { error: string | null }> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return { error: String(error) };
  }

  componentDidCatch(error: unknown) {
    postFrameStatus({
      type: frameStatusType,
      status: "error",
      slug: this.props.slug,
      message: String(error),
    });
  }

  render() {
    if (this.state.error) return <ErrorText message={this.state.error} />;
    return this.props.children;
  }
}

function ErrorText({ message }: { message: string }) {
  return <pre className="p-6 font-mono text-xs whitespace-pre-wrap">{message}</pre>;
}

/**
 * `/<slug>` renders one prototype standalone (the canvas iframe and evidence URL); `/` the
 * gallery. Component prototypes render inside the app's `PrototypeFrame` (its production chrome)
 * unless their meta sets `standalone`; drafts never do.
 */
function App() {
  const search = useSearch();
  const slug = window.location.pathname.replace(/^\/+|\/+$/g, "");
  const known = Boolean(loaderFor(slug));
  const loaded = usePrototype(slug);
  if (!known) return <Gallery />;
  if (!loaded) return null;
  if (!loaded.module) return <ErrorText message={loaded.error ?? ""} />;
  const { meta, default: Prototype } = loaded.module;
  const params = new URLSearchParams(search);
  const requested = params.get("state");
  const state = meta.states.find(option => option.id === requested)?.id ?? meta.states[0]?.id ?? "";
  const role = resolvePrototypeRole(params.get("role"), meta.roles, config.roles);
  const canvas = (
    <PrototypeBoundary key={`${state}:${role}`} slug={slug}>
      <Prototype state={state} role={role} />
      <ReportReady slug={slug} state={state} />
    </PrototypeBoundary>
  );
  return (
    <>
      <PresentationCanvas key={slug}>
        {kindFor(slug) === "component" && !meta.standalone ? (
          <PrototypeFrame route={meta.route} role={role} state={state}>
            {canvas}
          </PrototypeFrame>
        ) : (
          canvas
        )}
      </PresentationCanvas>
      {params.get("chrome") === "0" ? null : (
        <PrototypeToolbar slug={slug} meta={meta} state={state} />
      )}
    </>
  );
}

document.title = `Prototypes · ${config.title}`;
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ThemeProvider>
        <TooltipProvider>
          <App />
        </TooltipProvider>
      </ThemeProvider>
    </StrictMode>
  );
}
