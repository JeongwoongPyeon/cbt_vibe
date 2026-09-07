import { parseArgs } from "node:util";
import { startServer } from "./start";

try {
  const { values } = parseArgs({
    options: {
      dev: { type: "boolean", default: false },
      port: { type: "string", default: process.env.PORT || "3000" },
    },
  });
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("포트는 1부터 65535 사이의 정수여야 합니다.");
  }
  const server = await startServer({ port, dev: values.dev });
  console.log(`CBT ${values.dev ? "Vite + API" : "Web + API"}: ${server.url}`);
  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    await server.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
