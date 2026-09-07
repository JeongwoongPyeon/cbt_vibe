import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { getRequestListener } from "@hono/node-server";
import { Hono } from "hono";

const dataDir = mkdtempSync(path.join(tmpdir(), "cbt-vite-test-"));
process.env.CBT_DATA_DIR = dataDir;
process.env.OPENAI_API_KEY = "test-key-never-return-to-client";
const { createApp } = await import("../app");
const { closeDatabase } = await import("../../lib/db");
const server = createServer(getRequestListener(createApp().fetch));
const worker = new Hono();
const workerRequests: Array<{ path: string; body: unknown }> = [];
worker.post("/v1/workflows/questions/generate", async (c) => {
  const body = await c.req.json();
  workerRequests.push({ path: c.req.path, body });
  if (body.instruction === "fail") return c.json({ detail: "Worker test error" }, 422);
  return c.json({ questions: [], run: { id: "mock-generation" } });
});
worker.post("/v1/workflows/questions/import-images", async (c) => {
  const body = await c.req.formData();
  const files = body.getAll("images") as File[];
  workerRequests.push({ path: c.req.path, body: {
    examType: body.get("examType"), part: body.get("part"), unit: body.get("unit"),
    topic: body.get("topic"), maxQuestions: body.get("maxQuestions"),
    files: await Promise.all(files.map(async (file) => ({ name: file.name, text: await file.text() }))),
  } });
  return c.json({ questions: [], run: { id: "mock-photo" } });
});
const workerServer = createServer(getRequestListener(worker.fetch));
let url: string;
let questionId: string;

async function listen(server: ReturnType<typeof createServer>) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
}

before(async () => {
  url = await listen(server);
  process.env.AI_WORKER_URL = await listen(workerServer);
});
after(async () => {
  for (const current of [server, workerServer]) {
    current.closeAllConnections();
    await new Promise<void>((resolve) => current.close(() => resolve()));
  }
  closeDatabase();
  assert.equal(path.dirname(dataDir), path.resolve(tmpdir()));
  assert.ok(path.basename(dataDir).startsWith("cbt-vite-test-"));
  rmSync(dataDir, { recursive: true, force: true });
});

function jsonRequest(route: string, body: unknown, method = "POST") {
  return fetch(`${url}${route}`, {
    method, headers: { "Content-Type": "application/json", Origin: url }, body: JSON.stringify(body),
  });
}

test("health, exam separation and server-only environment status", async () => {
  assert.deepEqual(await (await fetch(`${url}/api/health`)).json(), { status: "ok" });
  for (const exam of ["ncs", "computer_general", "information_security"]) {
    const response = await fetch(`${url}/api/state?examType=${exam}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const state = await response.json();
    assert.equal(state.examType, exam);
    assert.ok(state.questions.length > 0);
    assert.ok(state.questions.every((q: { examType: string }) => q.examType === exam));
    assert.equal(state.env.openaiConfigured, true);
    assert.ok(!JSON.stringify(state).includes(process.env.OPENAI_API_KEY!));
  }
});

test("save all three question types and curriculum metadata", async () => {
  const questions = ["multiple_choice_4", "multiple_choice_5", "short_answer"].map((type) => ({
    examType: "computer_general", type, category: "Migration test",
    part: "Part", unit: "Unit", topic: "Topic", stem: `Test ${type}?`,
    choices: type === "short_answer" ? [] : ["1", "2", "3", "4", "5"].slice(0, type === "multiple_choice_4" ? 4 : 5),
    answer: "1", acceptableAnswers: [], explanation: "Test explanation", sourceType: "excel_import",
  }));
  const response = await jsonRequest("/api/questions", { questions });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.questions.length, 3);
  assert.equal(result.questions[0].unit, "Unit");
  assert.equal(result.questions[0].topic, "Topic");
  questionId = result.questions[0].id;
});

test("record wrong answer, save note, then resolve with correct answer", async () => {
  const wrong = await jsonRequest("/api/attempts", { questionId, selectedAnswer: "2", elapsedSeconds: 5 });
  assert.equal(wrong.status, 200);
  assert.equal((await wrong.json()).attempt.isCorrect, false);
  const note = await jsonRequest("/api/wrong-notes", { questionId, memo: "Review this", reasonTags: ["concept"] }, "PUT");
  assert.equal(note.status, 200);
  assert.equal((await note.json()).note.memo, "Review this");
  const correct = await jsonRequest("/api/attempts", { questionId, selectedAnswer: "1", mode: "review" });
  const result = await correct.json();
  assert.equal(result.attempt.isCorrect, true);
  assert.ok(result.state.wrongNotes.find((n: { questionId: string }) => n.questionId === questionId).resolvedAt);
});

test("data survives closing and reopening SQLite", async () => {
  closeDatabase();
  const state = await (await fetch(`${url}/api/state?examType=computer_general`)).json();
  assert.ok(state.questions.some((q: { id: string }) => q.id === questionId));
  assert.equal(state.attempts.length, 2);
  assert.equal(state.wrongNotes[0].memo, "Review this");
});

test("invalid drafts and malformed JSON return JSON errors", async () => {
  assert.equal((await jsonRequest("/api/questions", { stem: "Missing answer" })).status, 400);
  const response = await fetch(`${url}/api/questions`, { method: "POST", body: "{broken", headers: { "Content-Type": "application/json" } });
  assert.equal(response.status, 400);
  assert.ok((await response.json()).error);
  assert.equal((await jsonRequest("/api/attempts", { questionId: "missing" })).status, 400);
});

test("AI generation forwards criteria and the related base question", async () => {
  const response = await jsonRequest("/api/ai/generate", {
    provider: "gemini", examType: "computer_general", count: 3,
    part: "Part", unit: "Unit", topic: "Topic", baseQuestionId: questionId,
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).run.id, "mock-generation");
  const body = workerRequests.at(-1)!.body as { provider: string; unit: string; baseQuestion: { id: string } };
  assert.equal(body.provider, "gemini");
  assert.equal(body.unit, "Unit");
  assert.equal(body.baseQuestion.id, questionId);
});

test("multipart photos and Korean filenames reach the Worker intact", async () => {
  const form = new FormData();
  form.append("images", new File(["fake-image-one"], "문제1.png", { type: "image/png" }));
  form.append("images", new File(["fake-image-two"], "문제2.png", { type: "image/png" }));
  form.set("examType", "information_security");
  form.set("unit", "사진 단원");
  form.set("maxQuestions", "4");
  const response = await fetch(`${url}/api/ai/import-images`, { method: "POST", body: form });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).run.id, "mock-photo");
  const body = workerRequests.at(-1)!.body as { unit: string; files: Array<{ name: string; text: string }> };
  assert.equal(body.unit, "사진 단원");
  assert.deepEqual(body.files, [{ name: "문제1.png", text: "fake-image-one" }, { name: "문제2.png", text: "fake-image-two" }]);
});

test("missing photos and Worker errors are returned without crashing", async () => {
  const empty = await fetch(`${url}/api/ai/import-images`, { method: "POST", body: new FormData() });
  assert.equal(empty.status, 400);
  const failed = await jsonRequest("/api/ai/generate", { instruction: "fail" });
  assert.equal(failed.status, 400);
  assert.equal((await failed.json()).error, "Worker test error");
});

test("reject cross-origin requests, foreign hosts and oversized bodies", async () => {
  assert.equal((await fetch(`${url}/api/state`, { headers: { Origin: "https://example.com" } })).status, 403);
  assert.equal((await createApp().request("http://evil.example/api/state")).status, 403);
  const tooLarge = await createApp().request("http://localhost/api/questions", {
    method: "POST", headers: { "Content-Length": String(56 * 1024 * 1024) }, body: "x",
  });
  assert.equal(tooLarge.status, 413);
  assert.equal((await fetch(`${url}/api/unknown`)).status, 404);
  assert.equal((await fetch(`${url}/api/questions`)).status, 404);
});
