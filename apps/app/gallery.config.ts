import { defineGalleryConfig } from "@proto/gallery/config";

/** Prototype gallery of this app: `bun run proto dev` (see docs/design/prototyping.md). */
export default defineGalleryConfig({
  title: "Proto",
  specs: { auth: "Authentication" },
  siteUrl: "https://example.com",
});
