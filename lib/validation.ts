import { z } from "zod";
import type { DraftValidation, ExamType, QuestionDraft, QuestionType, SourceType } from "./types";
import { isExamType } from "./types";

const questionTypeSchema = z.enum([
  "multiple_choice_4",
  "multiple_choice_5",
  "short_answer",
]);

const sourceTypeSchema = z.enum([
  "manual",
  "photo_ocr",
  "excel_import",
  "ai_generated",
  "ai_expanded",
]);

const rawQuestionSchema = z.object({
  examType: z.string().optional().catch("computer_general"),
  type: questionTypeSchema.catch("multiple_choice_4"),
  category: z.string().optional().catch("미분류"),
  part: z.string().optional().catch(""),
  unit: z.string().optional().catch(""),
  topic: z.string().optional().catch(""),
  tags: z.union([z.array(z.string()), z.string()]).optional().catch([]),
  difficulty: z.string().optional().catch("보통"),
  stem: z.string().optional().catch(""),
  question: z.string().optional().catch(""),
  choices: z.array(z.string()).optional().catch([]),
  choice_1: z.string().optional().catch(""),
  choice_2: z.string().optional().catch(""),
  choice_3: z.string().optional().catch(""),
  choice_4: z.string().optional().catch(""),
  choice_5: z.string().optional().catch(""),
  answer: z.string().optional().catch(""),
  acceptableAnswers: z.union([z.array(z.string()), z.string()]).optional().catch([]),
  explanation: z.string().optional().catch(""),
  sourceType: sourceTypeSchema.optional().catch("manual"),
  sourceNote: z.string().optional().catch(""),
  sourceAssetId: z.string().optional().catch(undefined),
  sourcePage: z.coerce.number().int().positive().optional().catch(undefined),
  extractionConfidence: z.number().min(0).max(1).optional().catch(undefined),
  answerStatus: z.enum(["confirmed", "uncertain", "missing"]).optional().catch("confirmed"),
  reviewStatus: z.enum(["pending", "approved", "rejected"]).optional().catch("pending"),
  validationErrors: z.array(z.string()).optional().catch([]),
});

export function getChoiceCount(type: QuestionType): number {
  if (type === "multiple_choice_4") {
    return 4;
  }

  if (type === "multiple_choice_5") {
    return 5;
  }

  return 0;
}

export function getQuestionTypeLabel(type: QuestionType): string {
  if (type === "multiple_choice_4") {
    return "4지선다형";
  }

  if (type === "multiple_choice_5") {
    return "5지선다형";
  }

  return "단답형";
}

export function normalizeQuestionType(value: unknown): QuestionType {
  const raw = String(value ?? "").trim().toLowerCase();

  if (["4", "4지선다", "4지선다형", "multiple_choice_4", "mc4"].includes(raw)) {
    return "multiple_choice_4";
  }

  if (["5", "5지선다", "5지선다형", "multiple_choice_5", "mc5"].includes(raw)) {
    return "multiple_choice_5";
  }

  if (["단답", "단답형", "short", "short_answer"].includes(raw)) {
    return "short_answer";
  }

  return "multiple_choice_4";
}

export function normalizeExamType(value: unknown): ExamType {
  return isExamType(value) ? value : "computer_general";
}

export function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag).trim()).filter(Boolean);
  }

  return String(value ?? "")
    .split(/[,#\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizeTextList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value ?? "")
    .split(/[,|\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function validateQuestionDraft(raw: unknown): DraftValidation {
  const parsed = rawQuestionSchema.safeParse(raw);
  const data = parsed.success ? parsed.data : rawQuestionSchema.parse({});
  const type = normalizeQuestionType(data.type);
  const examType = normalizeExamType(data.examType);
  const errors: string[] = [];
  const requiredChoices = getChoiceCount(type);
  const stem = (data.stem || data.question || "").trim();
  const answer = (data.answer || "").trim();
  const sourceType = (data.sourceType || "manual") as SourceType;
  const choices =
    type === "short_answer"
      ? []
      : [
          ...(data.choices || []),
          data.choice_1 || "",
          data.choice_2 || "",
          data.choice_3 || "",
          data.choice_4 || "",
          data.choice_5 || "",
        ]
          .map((choice) => choice.trim())
          .filter(Boolean)
          .slice(0, requiredChoices);

  if (!stem) {
    errors.push("문제 지문이 비어 있습니다.");
  }

  if (!answer) {
    errors.push("정답이 비어 있습니다.");
  }

  if (type !== "short_answer" && choices.length !== requiredChoices) {
    errors.push(`${getQuestionTypeLabel(type)}은 보기 ${requiredChoices}개가 필요합니다.`);
  }

  const question: QuestionDraft = {
    examType,
    type,
    category: (data.category || "").trim() || "미분류",
    part: (data.part || "").trim(),
    unit: (data.unit || "").trim(),
    topic: (data.topic || "").trim(),
    tags: normalizeTags(data.tags),
    difficulty: (data.difficulty || "").trim() || "보통",
    stem,
    choices,
    answer,
    acceptableAnswers: normalizeTextList(data.acceptableAnswers),
    explanation: (data.explanation || "").trim(),
    sourceType,
    sourceNote: (data.sourceNote || "").trim(),
    sourceAssetId: data.sourceAssetId,
    sourcePage: data.sourcePage,
    extractionConfidence: data.extractionConfidence,
    answerStatus: data.answerStatus,
    reviewStatus: data.reviewStatus,
    validationErrors: data.validationErrors,
  };

  if (type === "short_answer" && question.acceptableAnswers.length === 0 && answer) {
    question.acceptableAnswers = [answer];
  }

  return {
    ok: errors.length === 0,
    question,
    errors,
  };
}

export function normalizeForCompare(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

export function parseJsonList(value: string, fallback: string[] = []): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : fallback;
  } catch {
    return fallback;
  }
}
