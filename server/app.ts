import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { GET as state } from "./routes/state";
import { POST as questions } from "./routes/questions";
import { POST as attempts } from "./routes/attempts";
import { PUT as wrongNotes } from "./routes/wrong-notes";
import { POST as generate } from "./routes/generate";
import { POST as importImages } from "./routes/import-images";
import { POST as exams } from "./routes/exams";

export function createApp(production = false) {
  const app = new Hono();
  app.use("*", async (c, next) => {
    const url = new URL(c.req.url);
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
      return c.json({ error: "로컬 주소로 접속해 주세요." }, 403);
    }
    const origin = c.req.header("Origin");
    if ((origin && origin !== url.origin) || c.req.header("Sec-Fetch-Site") === "cross-site") {
      return c.json({ error: "다른 사이트에서 보낸 요청은 허용하지 않습니다." }, 403);
    }
    await next();
    c.header("X-Content-Type-Options", "nosniff");
  });
  app.use("/api/*", async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
  });
  // Five 10 MiB images plus multipart metadata must fit in one request.
  app.use("/api/*", bodyLimit({
    maxSize: 55 * 1024 * 1024,
    onError: (c) => c.json({ error: "업로드 요청은 55MB 이하여야 합니다." }, 413),
  }));
  app.get("/api/health", (c) => c.json({ status: "ok" }));
  app.get("/api/state", (c) => state(c.req.raw));
  app.post("/api/questions", (c) => questions(c.req.raw));
  app.post("/api/attempts", (c) => attempts(c.req.raw));
  app.post("/api/exams", (c) => exams(c.req.raw));
  app.put("/api/wrong-notes", (c) => wrongNotes(c.req.raw));
  app.post("/api/ai/generate", (c) => generate(c.req.raw));
  app.post("/api/ai/import-images", (c) => importImages(c.req.raw));
  app.all("/api/*", (c) => c.json({ error: "API 경로 또는 요청 방식을 확인해 주세요." }, 404));

  if (production) {
    app.use("*", serveStatic({ root: "./dist/client" }));
    app.get("*", async (c, next) => {
      if (!c.req.header("Accept")?.includes("text/html") || /\.[^/]+$/.test(c.req.path)) {
        return c.notFound();
      }
      c.header("Cache-Control", "no-cache");
      return serveStatic({ path: "./dist/client/index.html" })(c, next);
    });
  }
  app.onError((error, c) => {
    if (error instanceof SyntaxError) {
      return c.json({ error: "올바른 JSON 형식으로 요청해 주세요." }, 400);
    }
    console.error(error);
    return c.json({ error: "요청 처리 중 오류가 발생했습니다." }, 500);
  });
  return app;
}
