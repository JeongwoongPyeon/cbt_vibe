import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, test } from "node:test";
import { krcBusinessQuestions } from "../../lib/krc-business-questions";
import { validateQuestionDraft } from "../../lib/validation";

const dir = mkdtempSync(path.join(tmpdir(), "cbt-krc-test-"));
process.env.CBT_DATA_DIR = dir;
const { getAppState, closeDatabase, deleteSubject, restoreSubject } = await import("../../lib/db");
after(() => {
  closeDatabase();
  assert.equal(path.dirname(dir), path.resolve(tmpdir()));
  assert.ok(path.basename(dir).startsWith("cbt-krc-test-"));
  rmSync(dir, { recursive: true, force: true });
});

test("40 original questions cover the supplied keywords and use balanced answer positions", () => {
  assert.equal(krcBusinessQuestions.length, 40);
  assert.equal(krcBusinessQuestions.filter(q => q.part === "가이드북 · 경영학원론").length, 25);
  assert.equal(krcBusinessQuestions.filter(q => q.part === "가이드북 · 회계·재무").length, 15);
  assert.equal(new Set(krcBusinessQuestions.map(q => q.stem)).size, 40);
  for (const topic of ["포디즘","포터의 5 Forces","페욜","M&A 방어전략","SWOT","기업결합","합명회사와 합자회사","제품믹스","제품조사방법","매트릭스 조직","점포형 소매상","광고 도달범위","광고 빈도","관대화 현상","인사평가 기법","투자부동산","손익분기점","책임중심점","레버리지도","회수기간법","기업가치와 투자안","직접노무원가 임률차이","내부대체가격","전환사채","차입원가"]) {
    assert.ok(krcBusinessQuestions.some(q => q.unit === topic), topic);
  }
  const positions = [0, 0, 0, 0];
  for (const question of krcBusinessQuestions) {
    assert.deepEqual(validateQuestionDraft(question).errors, []);
    assert.equal(new Set(question.choices).size, 4);
    assert.ok(question.explanation.trim().length > 0);
    positions[question.choices.indexOf(question.answer)]++;
  }
  assert.deepEqual(positions, [10, 10, 10, 10]);
});

test("calculation answers agree with independently calculated expected values", () => {
  const answers = krcBusinessQuestions.map(q => q.answer);
  assert.equal(answers[20], `${800 / 2000 * 100}%`);
  assert.equal(answers[21], `${4000 / 1000}회`);
  assert.equal(answers[27], `${900 / (8 - 5)}대`);
  assert.equal(answers[28], `${(800 + 400) / 4}개`);
  assert.equal(answers[31], `${4000 / (4000 - 3000)}배`);
  assert.equal(answers[32], `${1200 / (1200 - 400)}배`);
  assert.equal(answers[33], `${2 + (900 - 400 - 300) / 400}년`);
  assert.equal(answers[35], `${300 * (22000 - 20000) / 10000}만 원 불리`);
  assert.equal(answers[37], `${6 + (10 - 6 - 1)}천 원`);
  assert.equal(answers[38], `${1000000 / 20000 * 24000 / 10000}만 원`);
});

test("new subject seeds once, stays isolated, and deletion does not repopulate", () => {
  const other = getAppState("computer_general").questions;
  const state = getAppState("krc_business");
  assert.equal(state.questions.length, 40);
  assert.equal(state.attempts.length, 0);
  closeDatabase();
  assert.deepEqual(getAppState("krc_business").questions, state.questions);
  closeDatabase();
  const legacy = new DatabaseSync(path.join(dir, "cbt.sqlite"));
  legacy.exec("DELETE FROM content_updates; UPDATE questions SET source_note='KRC 창작 40 v1 · 과거 문항' WHERE exam_type='krc_business'");
  legacy.close();
  const upgraded = getAppState("krc_business");
  assert.equal(upgraded.questions.length, 80);
  assert.ok(state.questions.every(q => upgraded.questions.some(item => item.id === q.id)));
  closeDatabase();
  assert.equal(getAppState("krc_business").questions.length, 80);
  const subject = upgraded.subjects.find(s => s.id === "krc_business")!;
  deleteSubject(subject.id, subject);
  closeDatabase();
  assert.equal(getAppState().subjects.find(s => s.id === "krc_business")?.questions, 0);
  assert.equal(getAppState().subjects.find(s => s.id === "krc_business")?.active, false);
  restoreSubject("krc_business");
  closeDatabase();
  assert.equal(getAppState("krc_business").questions.length, 0);
  assert.deepEqual(getAppState("computer_general").questions, other);
});
