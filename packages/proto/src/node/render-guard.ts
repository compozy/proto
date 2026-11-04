import type { IncomingMessage, ServerResponse } from "node:http";
export function hostAllowed(
  host: string | undefined,
  port: number,
  allowed: readonly string[]
): boolean {
  return (
    !!host &&
    [`127.0.0.1:${port}`, `localhost:${port}`, ...allowed.map(name => `${name}:${port}`)].includes(
      host
    )
  );
}
/** Prepend to Vite so its own middleware cannot bypass the exact host and port policy. */
export function renderGuard(port: number, shellOrigin: string, allowed: readonly string[]) {
  return {
    route: "",
    handle(req: IncomingMessage, res: ServerResponse, next: () => void) {
      if (!hostAllowed(req.headers.host, port, allowed)) {
        res.statusCode = 403;
        res.end(JSON.stringify({ error: { code: "host_not_allowed" } }));
        return;
      }
      if (req.headers.host === `localhost:${port}`) {
        res.writeHead(302, { Location: `http://127.0.0.1:${port}${req.url}` });
        res.end();
        return;
      }
      res.setHeader("Content-Security-Policy", `frame-ancestors ${shellOrigin}`);
      next();
    },
  };
}
