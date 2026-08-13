export const QUESTION_TYPES = [
  "multiple_choice_4",
  "multiple_choice_5",
  "short_answer",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export const EXAM_TYPES = [
  { id: "ncs", label: "NCS" },
  { id: "computer_general", label: "컴퓨터일반" },
  { id: "information_security", label: "정보보호론" },
] as const;

export type ExamType = (typeof EXAM_TYPES)[number]["id"];

export function isExamType(value: unknown): value is ExamType {
  return EXAM_TYPES.some((exam) => exam.id === value);
}

export function getExamTypeLabel(examType: ExamType): string {
  return EXAM_TYPES.find((exam) => exam.id === examType)?.label || examType;
}

export type SourceType =
  | "manual"
  | "photo_ocr"
  | "excel_import"
  | "ai_generated"
  | "ai_expanded";

export type AttemptMode = "practice" | "exam" | "review";

export interface Question {
  id: string;
  examType: ExamType;
  type: QuestionType;
  category: string;
  part?: string;
  unit?: string;
  topic?: string;
  tags: string[];
  difficulty: string;
  stem: string;
  choices: string[];
  answer: string;
  acceptableAnswers: string[];
  explanation: string;
  sourceType: SourceType;
  sourceNote: string;
  sourceAssetId?: string;
  sourcePage?: number;
  extractionConfidence?: number;
  answerStatus?: "confirmed" | "uncertain" | "missing";
  reviewStatus?: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
}

export interface QuestionDraft {
  examType: ExamType;
  type: QuestionType;
  category: string;
  part?: string;
  unit?: string;
  topic?: string;
  tags: string[];
  difficulty: string;
  stem: string;
  choices: string[];
  answer: string;
  acceptableAnswers: string[];
  explanation: string;
  sourceType: SourceType;
  sourceNote: string;
  sourceAssetId?: string;
  sourcePage?: number;
  extractionConfidence?: number;
  answerStatus?: "confirmed" | "uncertain" | "missing";
  reviewStatus?: "pending" | "approved" | "rejected";
  validationErrors?: string[];
}

export interface Attempt {
  id: string;
  questionId: string;
  examType: ExamType;
  selectedAnswer: string;
  isCorrect: boolean;
  elapsedSeconds: number;
  mode: AttemptMode;
  createdAt: string;
}

export interface WrongNote {
  questionId: string;
  examType: ExamType;
  wrongCount: number;
  lastWrongAt: string;
  resolvedAt: string | null;
  reasonTags: string[];
  memo: string;
  updatedAt: string;
}

export interface RecentAttempt extends Attempt {
  questionStem: string;
  category: string;
}

export interface CategoryStat {
  category: string;
  total: number;
  correct: number;
  accuracy: number;
}

export interface AppStats {
  totalQuestions: number;
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number;
  openWrongNotes: number;
  categories: CategoryStat[];
}

export interface EnvStatus {
  openaiConfigured: boolean;
  geminiConfigured: boolean;
  openaiModel: string;
  geminiModel: string;
  defaultProvider: "openai" | "gemini";
}

export interface AppState {
  examType: ExamType;
  questions: Question[];
  attempts: Attempt[];
  wrongNotes: WrongNote[];
  recentAttempts: RecentAttempt[];
  stats: AppStats;
  env: EnvStatus;
}

export interface DraftValidation {
  ok: boolean;
  question: QuestionDraft;
  errors: string[];
}
