import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { DatabaseSync } from "node:sqlite";

const dataDir = mkdtempSync(path.join(tmpdir(), "cbt-subjects-test-"));
process.env.CBT_DATA_DIR = dataDir;
const { createApp } = await import("../app");
const { closeDatabase, getAppState, submitExam } = await import("../../lib/db");
const app = createApp();
const request = (body: unknown, method = "DELETE", route = "/api/subjects") =>
  app.request(`http://localhost${route}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
after(() => {
  closeDatabase();
  assert.equal(path.dirname(dataDir), path.resolve(tmpdir()));
  assert.ok(path.basename(dataDir).startsWith("cbt-subjects-test-"));
  rmSync(dataDir, { recursive: true, force: true });
});

test("subject deletion confirms scope, removes related data atomically and never reseeds", async () => {
  const original = getAppState("computer_general");
  const other = getAppState("information_security").questions;
  submitExam({
    submissionId: crypto.randomUUID(),
    responses: [
      {
        questionId: original.questions[0].id,
        selectedAnswer: "wrong",
        elapsedSeconds: 10,
      },
    ],
  });
  const subject = getAppState("computer_general").subjects.find(
    (s) => s.id === "computer_general",
  )!;
  assert.equal((await request({ id: "invalid" })).status, 400);
  assert.equal(
    (
      await request({
        id: subject.id,
        confirmation: "incorrect",
        expected: subject,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request({
        id: subject.id,
        confirmation: subject.label,
        expected: { ...subject, attempts: 0 },
      })
    ).status,
    409,
  );
  const db = new DatabaseSync(path.join(dataDir, "cbt.sqlite"));
  db.exec(
    "CREATE TRIGGER fail_subject_delete BEFORE UPDATE ON subjects BEGIN SELECT RAISE(ABORT,'test rollback'); END",
  );
  assert.equal(
    (
      await request({
        id: subject.id,
        confirmation: subject.label,
        expected: subject,
      })
    ).status,
    409,
  );
  assert.equal(getAppState(subject.id).attempts.length, 1);
  assert.equal(
    getAppState(subject.id).questions.length,
    original.questions.length,
  );
  db.exec("DROP TRIGGER fail_subject_delete");
  assert.equal(
    (
      await request({
        id: subject.id,
        confirmation: subject.label,
        expected: subject,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      db.prepare("SELECT COUNT(*) AS n FROM exam_submissions").get() as {
        n: number;
      }
    ).n,
    0,
  );
  assert.equal(
    (db.prepare("SELECT COUNT(*) AS n FROM wrong_notes").get() as { n: number })
      .n,
    0,
  );
  db.close();
  closeDatabase();
  const reloaded = getAppState(subject.id);
  assert.notEqual(reloaded.examType, subject.id);
  assert.deepEqual(getAppState("information_security").questions, other);
  assert.equal(
    reloaded.subjects.find((s) => s.id === subject.id)?.questions,
    0,
  );
  assert.equal(
    reloaded.subjects.find((s) => s.id === subject.id)?.active,
    false,
  );
  const draft = { ...original.questions[0], sourceType: "manual" };
  assert.equal(
    (
      await request(
        { questions: [{ ...draft, examType: "ncs" }, draft] },
        "POST",
        "/api/questions",
      )
    ).status,
    409,
  );
  assert.equal(getAppState("ncs").questions.length, 1);
  assert.equal(
    (await request({ examType: subject.id }, "POST", "/api/ai/generate"))
      .status,
    400,
  );
  assert.equal((await request({ id: subject.id }, "POST")).status, 200);
  closeDatabase();
  assert.equal(getAppState(subject.id).questions.length, 0);
});

test("all subjects may be deleted and an empty subject can be re-added", async () => {
  for (const subject of getAppState().subjects.filter((s) => s.active)) {
    assert.equal(
      (
        await request({
          id: subject.id,
          confirmation: subject.label,
          expected: subject,
        })
      ).status,
      200,
    );
  }
  closeDatabase();
  assert.ok(
    getAppState().subjects.every(
      (s) =>
        !s.active &&
        s.questions === 0 &&
        s.attempts === 0 &&
        s.wrongNotes === 0,
    ),
  );
  assert.equal((await request({ id: "ncs" }, "POST")).status, 200);
  assert.equal(getAppState().questions.length, 0);
});
