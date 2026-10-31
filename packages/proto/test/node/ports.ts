import { randomInt } from "node:crypto";
import { createServer, type Server } from "node:net";

/** Check both ports outside the OS ephemeral range used by browser/client connections. */
export async function freePortPair(): Promise<number> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const port = randomInt(12000, 28000);
    const sockets: Server[] = [];
    try {
      for (const candidate of [port, port + 1]) {
        const socket = createServer();
        sockets.push(socket);
        await new Promise<void>((resolve, reject) => {
          socket.once("error", reject);
          socket.listen(candidate, "127.0.0.1", resolve);
        });
      }
      return port;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
    } finally {
      await Promise.all(
        sockets.map(socket => new Promise<void>(resolve => socket.close(() => resolve())))
      );
    }
  }
  throw new Error("Could not allocate an unused test port pair");
}
