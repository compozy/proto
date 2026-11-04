// Prepare shared dependencies without importing or executing any selected CSF file.
import "react-dom/client";
import "virtual:proto/story-runtime";
import { loadPreview } from "virtual:proto/story-preview";
import { messageOf } from "./errors.ts";

void loadPreview().then(
  () => {
    document.documentElement.dataset.protoStoryWarmup = "ready";
  },
  error => {
    document.documentElement.dataset.protoStoryWarmup = JSON.stringify({ error: messageOf(error) });
  }
);
