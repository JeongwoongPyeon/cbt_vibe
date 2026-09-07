import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
process.chdir(root);
if (existsSync(".env")) loadEnvFile(".env");
const { values } = parseArgs({
  options: {
    port: { type: "string", default: process.env.PORT || "3000" },
    "worker-port": { type: "string", default: "8001" },
  },
});
for (const port of Object.values(values)) {
  if (!Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error("Ports must be integers between 1 and 65535.");
  }
}
const probe = createServer();
await new Promise((resolve, reject) => {
  probe.once("error", () => reject(new Error(`Worker port ${values["worker-port"]} is already in use.`)));
  probe.listen(Number(values["worker-port"]), "127.0.0.1", () => probe.close(resolve));
});
const venvPython = path.join(root, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const python = existsSync(venvPython) ? venvPython : process.platform === "win32" ? "python" : "python3";
const env = { ...process.env, AI_WORKER_URL: `http://127.0.0.1:${values["worker-port"]}`, PYTHONUNBUFFERED: "1" };
const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    } else {
      child.kill("SIGTERM");
    }
  }
  process.exitCode = code;
}
function launch(command, args) {
  const child = spawn(command, args, { cwd: root, env, stdio: "inherit", windowsHide: true });
  children.push(child);
  child.on("error", (error) => { console.error(error.message); stop(1); });
  child.on("exit", (code) => stop(code ?? 1));
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
launch(python, ["-m", "uvicorn", "app.main:app", "--app-dir", "ai-worker", "--host", "127.0.0.1", "--port", values["worker-port"]]);
launch(process.execPath, ["node_modules/tsx/dist/cli.mjs", "watch", "--clear-screen=false", "server/index.ts", "--dev", "--port", values.port]);
console.log(`CBT Worker: ${env.AI_WORKER_URL}`);
console.log("Press Ctrl+C to stop both servers.");
