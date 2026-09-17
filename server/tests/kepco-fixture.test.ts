import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as XLSX from "xlsx";
import { normalizeQuestionType, validateQuestionDraft } from "../../lib/validation";

test("KEPCO ICT workbook imports 100 unique four-choice questions with matching answers", () => {
  const workbook = XLSX.read(readFileSync(new URL("../../outputs/kepco-ict-20260917/한전ICT_정보통신시스템_100문항.xlsx", import.meta.url)));
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
  const groups = JSON.parse(readFileSync(new URL("../../test-data/kepco-ict-100.json", import.meta.url), "utf8")) as { unit: string; items: string[][] }[];
  const source = groups.flatMap(group => group.items);
  assert.equal(workbook.SheetNames[0], "문제");
  assert.equal(rows.length, 100);
  assert.equal(new Set(rows.map(row => row.question)).size, 100);
  const units = new Map<string, number>();
  const answerCounts = [0, 0, 0, 0];
  rows.forEach((row, index) => {
    const choices = [row.choice_1, row.choice_2, row.choice_3, row.choice_4, row.choice_5]
      .map(value => String(value || "").trim()).filter(Boolean);
    const validation = validateQuestionDraft({
      type: normalizeQuestionType(row.type), examType: row.exam_type,
      category: row.category, part: row.part, unit: row.unit, topic: row.topic,
      stem: row.question, choices, answer: row.answer,
      acceptableAnswers: row.acceptable_answers, explanation: row.explanation,
      tags: row.tags, difficulty: row.difficulty, sourceType: "excel_import",
      sourceNote: "한전ICT_정보통신시스템_100문항.xlsx",
    });
    assert.deepEqual(validation.errors, [], `Row ${index + 2}`);
    assert.equal(validation.question.type, "multiple_choice_4");
    assert.equal(validation.question.examType, "computer_general");
    assert.equal(choices.length, 4);
    assert.equal(new Set(choices).size, 4);
    assert.equal(choices.filter(choice => choice === row.answer).length, 1);
    assert.equal(choices[Number(row.answer_no) - 1], row.answer);
    assert.equal(row.answer, source[index][3]);
    assert.equal(row.question, source[index][2]);
    assert.equal(row.explanation, source[index][7]);
    assert.equal(row.no, index + 1);
    assert.ok(String(row.explanation).length > 20);
    assert.ok(String(row.source_note).includes("면접스터디_정보통신시스템.docx"));
    units.set(String(row.unit), (units.get(String(row.unit)) || 0) + 1);
    answerCounts[Number(row.answer_no) - 1]++;
  });
  assert.equal(units.size, 10);
  assert.ok([...units.values()].every(count => count === 10));
  assert.deepEqual(answerCounts, [25, 25, 25, 25]);
});
