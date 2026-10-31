import { defineCommand } from "citty";
import { createServer } from "vite";

import { galleryViteConfig } from "../../node/vite-config";

export default defineCommand({
  meta: { description: "Start the review gallery (http://127.0.0.1:4400)" },
  args: {
    port: { type: "string", default: "4400" },
    host: { type: "string", default: "127.0.0.1" },
  },
  async run({ args }) {
    const port = Number(args.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid port");
    const config = await galleryViteConfig("serve");
    const server = await createServer({
      ...config,
      server: { ...config.server, port, host: args.host },
    });
    await server.listen();
    server.printUrls();
    const stop = () => void server.close().then(() => process.exit(0));
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  },
});
