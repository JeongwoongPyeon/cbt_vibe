import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const wasmDir = path.join(root, "node_modules", "@next", "swc-wasm-nodejs");
const args = process.argv.slice(2);

process.env.NEXT_TEST_WASM_DIR = wasmDir;

const child = spawn(process.execPath, [nextBin, ...args], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

