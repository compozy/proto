import { defineCommand } from "citty";
import { build } from "vite";

import { galleryViteConfig } from "../../node/vite-config";

export default defineCommand({
  meta: { description: "Build the static review gallery into apps/<app>/dist-gallery" },
  args: { revision: { type: "string", description: "Full Git commit SHA stamped on comments" } },
  async run({ args }) {
    if (args.revision) process.env.REVISION = args.revision;
    await build(await galleryViteConfig("build"));
  },
});
