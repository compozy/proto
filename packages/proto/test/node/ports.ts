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

/**
 * Runs `start(port)` on a random even port (its render pair is port + 1) until both bind:
 * the bind itself is the check, so a port taken by a parallel suite is retried, not raced.
 */
export async function onFreePorts<T>(start: (port: number) => Promise<T>) {
  for (let attempt = 0; ; attempt += 1) {
    const port = 20_000 + 2 * Math.floor(Math.random() * 20_000);
    try {
      return await start(port);
    } catch (error) {
      const busy =
        (error as { code?: string }).code === "port_in_use" ||
        (error as NodeJS.ErrnoException).code === "EADDRINUSE";
      if (!busy || attempt >= 20) throw error;
    }
  }
}
