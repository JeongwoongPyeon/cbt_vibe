import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { getRequestListener } from "@hono/node-server";
import type { ViteDevServer } from "vite";
import { createApp } from "./app";
import { closeDatabase } from "../lib/db";

export async function startServer({ port = 3000, dev = false } = {}) {
  if (!dev && !existsSync("dist/client/index.html")) {
    throw new Error("먼저 npm run build를 실행해 주세요.");
  }
  const app = createApp(!dev);
  const apiListener = getRequestListener(app.fetch);
  let vite: ViteDevServer | undefined;
  const server = createServer((request, response) => {
    const host = request.headers.host || "";
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) {
      response.writeHead(403).end("Local access only");
      return;
    }
    const pathname = new URL(request.url || "/", `http://${host}`).pathname;
    if (vite && pathname !== "/api" && !pathname.startsWith("/api/")) {
      vite.middlewares(request, response);
    } else {
      void apiListener(request, response);
    }
  });
  try {
    // Retry only in development, without stopping the process that owns a port.
    for (let attempt = 0; ; attempt++) {
      try {
        await new Promise<void>((resolve, reject) => {
          server.once("error", reject);
          server.listen(port, "127.0.0.1", () => {
            server.off("error", reject);
            resolve();
          });
        });
        break;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        const unavailable = code === "EADDRINUSE" || (process.platform === "win32" && code === "EACCES");
        if (!dev || !unavailable || attempt >= 20 || port >= 65535) {
          throw error;
        }
        port++;
      }
    }
    if (dev) {
      const { createServer: createViteServer } = await import("vite");
      vite = await createViteServer({ server: { middlewareMode: true, ws: { server } } });
    }
  } catch (error) {
    await vite?.close();
    server.close();
    throw error;
  }
  const address = server.address();
  const url = `http://127.0.0.1:${typeof address === "object" && address ? address.port : port}`;
  return {
    url,
    async close() {
      await vite?.close();
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      closeDatabase();
    },
  };
}
