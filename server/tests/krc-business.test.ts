import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
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
  assert.equal(krcBusinessQuestions.filter(q => q.part === "경영학원론").length, 25);
  assert.equal(krcBusinessQuestions.filter(q => q.part === "회계·재무").length, 15);
  assert.equal(new Set(krcBusinessQuestions.map(q => q.stem)).size, 40);
  for (const topic of ["BCG 매트릭스", "EPS", "PER", "SWOT", "감가상각", "광고의 특징", "균형성과표", "매슬로우 욕구단계", "매출총이익", "손상차손", "의사소통 오류", "이직률 계산", "테일러 과학적 관리론"]) {
    assert.ok(krcBusinessQuestions.some(q => q.unit === topic), topic);
  }
  const positions = [0, 0, 0, 0];
  for (const question of krcBusinessQuestions) {
    assert.deepEqual(validateQuestionDraft(question).errors, []);
    assert.equal(new Set(question.choices).size, 4);
    assert.ok(question.explanation.length > 55);
    positions[question.choices.indexOf(question.answer)]++;
  }
  assert.deepEqual(positions, [10, 10, 10, 10]);
});

test("calculation answers agree with independently calculated expected values", () => {
  const answers = krcBusinessQuestions.map(q => q.answer);
  assert.equal(answers[16], `${16 / ((180 + 220) / 2) * 100}%`);
  assert.equal(answers[25], `${((120000000 - 20000000) / 50000).toLocaleString("en-US")}원`);
  assert.equal(answers[26], `${(150000000 / (40000 * 0.5 + 60000 * 0.5)).toLocaleString("en-US")}원`);
  assert.equal(answers[27], `${24000 / 2000}배`);
  assert.equal(answers[29], `${(1100 - 100) / 5}만 원`);
  assert.equal(answers[30], `${(1300 - 100) / 4 * 0.5}만 원`);
  assert.equal(answers[31], `${1000 * 0.6 * 0.4}만 원`);
  assert.equal(answers[34], `${900 - Math.max(650, 720)}만 원`);
  assert.equal(answers[36], `${1000 / (5 - 3)}개`);
  assert.equal(answers[37], `${80 + 300 + 200 + 100 - 50}만 원`);
});

test("new subject seeds once, stays isolated, and deletion does not repopulate", () => {
  const other = getAppState("computer_general").questions;
  const state = getAppState("krc_business");
  assert.equal(state.questions.length, 40);
  assert.equal(state.attempts.length, 0);
  closeDatabase();
  assert.deepEqual(getAppState("krc_business").questions, state.questions);
  const subject = state.subjects.find(s => s.id === "krc_business")!;
  deleteSubject(subject.id, subject);
  closeDatabase();
  assert.equal(getAppState().subjects.find(s => s.id === "krc_business")?.questions, 0);
  assert.equal(getAppState().subjects.find(s => s.id === "krc_business")?.active, false);
  restoreSubject("krc_business");
  closeDatabase();
  assert.equal(getAppState("krc_business").questions.length, 0);
  assert.deepEqual(getAppState("computer_general").questions, other);
});
