import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL("./client", import.meta.url)),
  plugins: [react()],
  resolve: { alias: { "@": root } },
  css: { postcss: root },
  server: {
    host: "127.0.0.1",
    fs: {
      allow: [root],
      deny: [
        "**/.env", "**/.env.*", "**/*.{crt,pem}", "**/.git/**",
        "**/local-data/**", "**/*.{db,sqlite,sqlite3}",
        "**/server/**", "**/ai-worker/**", "**/.venv/**",
        "**/lib/db.ts", "**/lib/ai.ts",
      ],
    },
  },
  build: {
    outDir: fileURLToPath(new URL("./dist/client", import.meta.url)),
    emptyOutDir: true,
  },
});
