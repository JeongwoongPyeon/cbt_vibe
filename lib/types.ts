export const QUESTION_TYPES = [
  "multiple_choice_4",
  "multiple_choice_5",
  "short_answer",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export type SourceType =
  | "manual"
  | "photo_ocr"
  | "excel_import"
  | "ai_generated"
  | "ai_expanded";

export type AttemptMode = "practice" | "exam" | "review";

export interface Question {
  id: string;
  type: QuestionType;
  category: string;
  tags: string[];
  difficulty: string;
  stem: string;
  choices: string[];
  answer: string;
  acceptableAnswers: string[];
  explanation: string;
  sourceType: SourceType;
  sourceNote: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionDraft {
  type: QuestionType;
  category: string;
  tags: string[];
  difficulty: string;
  stem: string;
  choices: string[];
  answer: string;
  acceptableAnswers: string[];
  explanation: string;
  sourceType: SourceType;
  sourceNote: string;
}

export interface Attempt {
  id: string;
  questionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
  elapsedSeconds: number;
  mode: AttemptMode;
  createdAt: string;
}

export interface WrongNote {
  questionId: string;
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

