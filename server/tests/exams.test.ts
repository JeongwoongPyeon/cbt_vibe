import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { DatabaseSync } from "node:sqlite";

const dir = mkdtempSync(path.join(tmpdir(), "cbt-exam-test-"));
process.env.CBT_DATA_DIR = dir;
const { createApp } = await import("../app");
const { closeDatabase, getAppState } = await import("../../lib/db");
const app = createApp();
let ids: string[];
const request = (body: unknown) =>
  app.request("http://localhost/api/exams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const responseFor = (questionId: string, selectedAnswer = "A") => ({
  questionId,
  selectedAnswer,
  elapsedSeconds: 3,
});

before(async () => {
  const response = await app.request("http://localhost/api/questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      questions: [1, 2, 3].map((i) => ({
        examType: "computer_general",
        type: "short_answer",
        stem: `Exam test ${i}`,
        category: "Test",
        answer: "A",
        explanation: "Test explanation",
      })),
    }),
  });
  ids = (await response.json()).questions.map((q: { id: string }) => q.id);
});
after(() => {
  closeDatabase();
  assert.equal(path.dirname(dir), path.resolve(tmpdir()));
  assert.ok(path.basename(dir).startsWith("cbt-exam-test-"));
  rmSync(dir, { recursive: true, force: true });
});

test("exam submits all questions once, including unanswered questions", async () => {
  const submission = {
    submissionId: crypto.randomUUID(),
    responses: ids.map((id, i) =>
      responseFor(id, i === 0 ? "A" : i === 1 ? "wrong" : ""),
    ),
  };
  const result = await request(submission);
  assert.equal(result.status, 200);
  const payload = await result.json();
  assert.deepEqual(
    payload.attempts.map((a: { isCorrect: boolean }) => a.isCorrect),
    [true, false, false],
  );
  assert.ok(payload.attempts.every((a: { mode: string }) => a.mode === "exam"));
  assert.equal(payload.state.attempts.length, 3);
  assert.equal(payload.state.wrongNotes.length, 2);
  const retry = await request(submission);
  const retried = await retry.json();
  assert.deepEqual(retried.attempts, payload.attempts);
  assert.equal(retried.state.attempts.length, 3);
  assert.ok(
    retried.state.wrongNotes.every(
      (note: { wrongCount: number }) => note.wrongCount === 1,
    ),
  );
  assert.equal(
    (
      await request({
        ...submission,
        responses: ids.map((id) => responseFor(id)),
      })
    ).status,
    400,
  );
});

test("invalid, duplicate and mixed-exam submissions do not add any attempts", async () => {
  const initial = getAppState("computer_general").attempts.length;
  const ncsId = getAppState("ncs").questions[0].id;
  for (const responses of [
    [],
    [responseFor("missing")],
    [responseFor(ids[0]), responseFor(ids[0])],
    [responseFor(ids[0]), responseFor(ncsId)],
    [{ ...responseFor(ids[0]), elapsedSeconds: -1 }],
    Array.from({ length: 101 }, () => responseFor(ids[0])),
  ]) {
    assert.equal(
      (await request({ submissionId: crypto.randomUUID(), responses })).status,
      400,
    );
    assert.equal(getAppState("computer_general").attempts.length, initial);
  }
});

test("database failure rolls back both attempts and wrong-note changes", async () => {
  const db = new DatabaseSync(path.join(dir, "cbt.sqlite"));
  db.exec(
    "CREATE TRIGGER fail_exam BEFORE INSERT ON attempts WHEN NEW.selected_answer = 'rollback' BEGIN SELECT RAISE(ABORT, 'test failure'); END",
  );
  const initial = getAppState("computer_general");
  const submission = {
    submissionId: crypto.randomUUID(),
    responses: [responseFor(ids[0], "wrong"), responseFor(ids[1], "rollback")],
  };
  const result = await request(submission);
  assert.equal(result.status, 400);
  assert.deepEqual(getAppState("computer_general").attempts, initial.attempts);
  assert.deepEqual(
    getAppState("computer_general").wrongNotes,
    initial.wrongNotes,
  );
  db.exec("DROP TRIGGER fail_exam");
  db.close();
  assert.equal((await request(submission)).status, 200);
});
