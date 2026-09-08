import assert from "node:assert/strict";
import { test } from "node:test";
import {
  attemptHistory,
  emptyFilters,
  filterQuestions,
  selectExamQuestions,
  similarQuestions,
  UNASSIGNED,
} from "../../lib/study";
import {
  freezeSubmission,
  parseExamSession,
  settleExamTime,
  type ExamSession,
} from "../../lib/exam";
import type { Attempt, Question } from "../../lib/types";

function question(id: string, overrides: Partial<Question> = {}): Question {
  return {
    id,
    examType: "computer_general",
    type: "short_answer",
    category: "OS",
    part: "컴퓨터",
    unit: "운영체제",
    topic: "프로세스",
    tags: ["CPU"],
    difficulty: "보통",
    stem: `Question ${id}`,
    choices: [],
    answer: "A",
    acceptableAnswers: [],
    explanation: "Explanation",
    sourceType: "manual",
    sourceNote: "Test",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    ...overrides,
  };
}
function attempt(id: string, overrides: Partial<Attempt> = {}): Attempt {
  return {
    id,
    questionId: "a",
    examType: "computer_general",
    selectedAnswer: "A",
    isCorrect: true,
    elapsedSeconds: 10,
    mode: "practice",
    createdAt: `2026-01-01T00:00:0${id}.000Z`,
    ...overrides,
  };
}

test("history retains only the latest five, including exam attempts and stable ties", () => {
  const history = attemptHistory([
    attempt("1"),
    attempt("5"),
    attempt("2"),
    attempt("6", { mode: "exam", isCorrect: false }),
    attempt("3"),
    attempt("4"),
    attempt("7", { questionId: "b" }),
  ]);
  assert.deepEqual(
    history.get("a")!.map((a) => a.id),
    ["6", "5", "4", "3", "2"],
  );
  assert.equal(history.get("a")![0].isCorrect, false);
  assert.equal(history.get("b")!.length, 1);
  const tied = attemptHistory([
    attempt("2", { createdAt: "same" }),
    attempt("1", { createdAt: "same" }),
  ]);
  assert.deepEqual(
    tied.get("a")!.map((a) => a.id),
    ["2", "1"],
  );
});

test("combine chapter, unit, search and attempted filters, including unassigned questions", () => {
  const questions = [
    question("a"),
    question("b", { unit: "DB", stem: "정규화" }),
    question("c", { part: "", unit: "" }),
  ];
  assert.deepEqual(
    filterQuestions(questions, [attempt("1")], {
      ...emptyFilters,
      status: "solved",
    }).map((q) => q.id),
    ["a"],
  );
  assert.deepEqual(
    filterQuestions(
      questions,
      [attempt("1")],
      { part: "컴퓨터", unit: "DB", status: "unsolved" },
      "정규",
    ).map((q) => q.id),
    ["b"],
  );
  assert.deepEqual(
    filterQuestions(questions, [], { ...emptyFilters, part: UNASSIGNED }).map(
      (q) => q.id,
    ),
    ["c"],
  );
  assert.equal(
    filterQuestions(questions, [], { ...emptyFilters, unit: "none" }).length,
    0,
  );
});

test("similarity stays within the exam and prioritizes scoped units and topics", () => {
  const base = question("base");
  const ranked = similarQuestions(base, [
    base,
    question("unit", { topic: "메모리" }),
    question("topic"),
    question("other-exam", { examType: "ncs" }),
    question("other-part", {
      part: "회계",
      topic: "",
      category: "회계",
      tags: [],
    }),
  ]);
  assert.deepEqual(
    ranked.map((r) => r.question.id),
    ["topic", "unit"],
  );
  assert.ok(ranked[0].reasons.includes("같은 세부 주제"));
  assert.equal(
    similarQuestions(
      question("blank", {
        part: "",
        unit: "",
        topic: "",
        category: "미분류",
        tags: [],
      }),
      [
        question("none", {
          part: "",
          unit: "",
          topic: "",
          category: "미분류",
          tags: [],
        }),
      ],
    ).length,
    0,
  );
});

test("exam selection is bounded, unique and leaves the original list untouched", () => {
  const questions = [question("a"), question("b"), question("c")];
  const selected = selectExamQuestions(questions, 2, () => 0);
  assert.equal(selected.length, 2);
  assert.equal(new Set(selected.map((q) => q.id)).size, 2);
  assert.deepEqual(
    questions.map((q) => q.id),
    ["a", "b", "c"],
  );
  assert.equal(selectExamQuestions(questions, 20).length, 3);
});

test("exam clock includes navigation time, caps at deadline and freezes retry payloads", () => {
  const session: ExamSession = {
    id: crypto.randomUUID(),
    examType: "ncs",
    questionIds: ["a", "b"],
    activeId: "a",
    answers: { a: "A" },
    flagged: ["b"],
    startedAt: 1000,
    activeSince: 1000,
    deadline: 11000,
    spentMs: {},
  };
  const moved = { ...settleExamTime(session, 4000), activeId: "b" };
  const frozen = freezeSubmission(moved, 20000);
  assert.deepEqual(frozen.submission!.responses, [
    { questionId: "a", selectedAnswer: "A", elapsedSeconds: 3 },
    { questionId: "b", selectedAnswer: "", elapsedSeconds: 7 },
  ]);
  assert.equal(freezeSubmission(frozen, 30000), frozen);
  assert.deepEqual(parseExamSession(JSON.stringify(frozen), "ncs"), frozen);
  assert.equal(
    parseExamSession(JSON.stringify(frozen), "computer_general"),
    null,
  );
  assert.equal(parseExamSession("broken", "ncs"), null);
});
