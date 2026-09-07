import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  build: {
    ssr: "server/index.ts",
    outDir: "dist/server",
    target: "node24",
    emptyOutDir: true,
  },
});
