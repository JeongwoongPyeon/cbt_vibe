import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

const dataDir = mkdtempSync(path.join(tmpdir(), "cbt-vite-runtime-"));
process.env.CBT_DATA_DIR = dataDir;
const { startServer } = await import("../start");

after(() => {
  assert.equal(path.dirname(dataDir), path.resolve(tmpdir()));
  assert.ok(path.basename(dataDir).startsWith("cbt-vite-runtime-"));
  rmSync(dataDir, { recursive: true, force: true });
});

test("development serves Vite, retries an occupied port and protects local files", async () => {
  const occupied = createServer();
  await new Promise<void>((resolve) => occupied.listen(0, "127.0.0.1", resolve));
  const address = occupied.address();
  assert.ok(address && typeof address === "object");
  let server: Awaited<ReturnType<typeof startServer>> | undefined;
  try {
    server = await startServer({ dev: true, port: address.port });
    assert.notEqual(new URL(server.url).port, String(address.port));
    const html = await (await fetch(server.url)).text();
    assert.ok(html.includes("/@vite/client"));
    assert.ok(html.includes("/main.tsx"));
    const state = await fetch(`${server.url}/api/state?examType=ncs`);
    assert.equal(state.status, 200);
    assert.equal((await state.json()).examType, "ncs");
    const root = process.cwd().replaceAll("\\", "/");
    for (const file of [".env", "lib/db.ts", "lib/ai.ts", "server/app.ts", "local-data/cbt.sqlite", "ai-worker/app/config.py"]) {
      const response: Response = await fetch(`${server.url}/@fs/${root}/${file}`);
      assert.ok([403, 404].includes(response.status), `${file}: ${response.status}`);
      await response.arrayBuffer();
    }
    assert.equal((await fetch(`${server.url}/api/unknown`)).status, 404);
  } finally {
    await server?.close();
    await new Promise<void>((resolve) => occupied.close(() => resolve()));
  }
});

test("production serves built assets and fonts, without exposing backend files", {
  skip: !existsSync("dist/client/index.html") && "Run npm run build to include production checks",
}, async () => {
  const server = await startServer({ port: 0 });
  try {
    const response = await fetch(server.url);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(!html.includes("/@vite/client"));
    assert.ok(html.includes("/assets/"));
    for (const asset of readdirSync("dist/client/assets")) {
      const result = await fetch(`${server.url}/assets/${asset}`);
      assert.equal(result.status, 200, asset);
      assert.ok((await result.arrayBuffer()).byteLength > 0);
      if (asset.endsWith(".js")) {
        const code = readFileSync(path.join("dist/client/assets", asset), "utf8");
        assert.ok(!code.includes("node:sqlite"));
        // Settings may show environment variable names, never server reads or values.
        for (const key of ["OPENAI_API_KEY", "GEMINI_API_KEY", "ANTHROPIC_API_KEY"]) {
          assert.ok(!code.includes(`process.env.${key}`));
          const secret = process.env[key];
          if (secret && secret.length >= 12) assert.ok(!code.includes(secret));
        }
      }
    }
    for (const route of ["/.env", "/local-data/cbt.sqlite", "/lib/db.ts", "/server/app.ts", "/assets/missing.js", "/api/unknown"]) {
      const result = await fetch(`${server.url}${route}`, { headers: { Accept: "text/html" } });
      assert.equal(result.status, 404, route);
      await result.arrayBuffer();
    }
    const fallback = await fetch(`${server.url}/practice`, { headers: { Accept: "text/html" } });
    assert.equal(fallback.status, 200);
    assert.ok((await fallback.text()).includes('<div id="root">'));
    assert.equal((await fetch(`${server.url}/api/state`)).status, 200);
  } finally {
    await server.close();
  }
});
