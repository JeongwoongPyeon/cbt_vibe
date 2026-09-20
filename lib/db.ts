import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  AppState,
  Attempt,
  AttemptMode,
  CategoryStat,
  ExamType,
  EnvStatus,
  Question,
  QuestionDraft,
  RecentAttempt,
  WrongNote,
  SubjectSummary,
} from "./types";
import { EXAM_TYPES } from "./types";
import { AI_PROVIDERS, resolveProvider } from "./providers";
import { normalizeExamType, normalizeForCompare, parseJsonList } from "./validation";
import type { ExamSubmission } from "./exam";

const dbDir = path.resolve(process.env.CBT_DATA_DIR || "local-data");
const dbPath = path.join(dbDir, "cbt.sqlite");

type QuestionRow = {
  id: string;
  exam_type: ExamType;
  type: Question["type"];
  category: string;
  part?: string | null;
  unit?: string | null;
  topic?: string | null;
  tags: string;
  difficulty: string;
  stem: string;
  choices: string;
  answer: string;
  acceptable_answers: string;
  explanation: string;
  source_type: Question["sourceType"];
  source_note: string;
  source_asset_id?: string | null;
  source_page?: number | null;
  extraction_confidence?: number | null;
  answer_status?: Question["answerStatus"];
  review_status?: Question["reviewStatus"];
  created_at: string;
  updated_at: string;
};

type AttemptRow = {
  id: string;
  question_id: string;
  selected_answer: string;
  is_correct: number;
  elapsed_seconds: number;
  mode: AttemptMode;
  created_at: string;
  question_stem?: string;
  category?: string;
  exam_type?: ExamType;
};

type WrongNoteRow = {
  question_id: string;
  exam_type?: ExamType;
  wrong_count: number;
  last_wrong_at: string;
  resolved_at: string | null;
  reason_tags: string;
  memo: string;
  updated_at: string;
};

const globalForDb = globalThis as typeof globalThis & {
  cbtDb?: DatabaseSync;
};

export function closeDatabase(): void {
  globalForDb.cbtDb?.close();
  globalForDb.cbtDb = undefined;
}

function now(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function getDb(): DatabaseSync {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  if (!globalForDb.cbtDb) {
    globalForDb.cbtDb = new DatabaseSync(dbPath);
    initializeDb(globalForDb.cbtDb);
  }

  return globalForDb.cbtDb;
}

function initializeDb(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS exam_submissions (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      results TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      exam_type TEXT NOT NULL DEFAULT 'computer_general',
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      part TEXT NOT NULL DEFAULT '',
      unit TEXT NOT NULL DEFAULT '',
      topic TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      stem TEXT NOT NULL,
      choices TEXT NOT NULL,
      answer TEXT NOT NULL,
      acceptable_answers TEXT NOT NULL,
      explanation TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_note TEXT NOT NULL,
      source_asset_id TEXT,
      source_page INTEGER,
      extraction_confidence REAL,
      answer_status TEXT NOT NULL DEFAULT 'confirmed',
      review_status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attempts (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL,
      selected_answer TEXT NOT NULL,
      is_correct INTEGER NOT NULL,
      elapsed_seconds INTEGER NOT NULL,
      mode TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (question_id) REFERENCES questions(id)
    );

    CREATE TABLE IF NOT EXISTS wrong_notes (
      question_id TEXT PRIMARY KEY,
      wrong_count INTEGER NOT NULL,
      last_wrong_at TEXT NOT NULL,
      resolved_at TEXT,
      reason_tags TEXT NOT NULL,
      memo TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (question_id) REFERENCES questions(id)
    );
  `);

  const questionColumns = db.prepare("PRAGMA table_info(questions)").all() as Array<{ name: string }>;

  if (!questionColumns.some((column) => column.name === "exam_type")) {
    db.exec("ALTER TABLE questions ADD COLUMN exam_type TEXT NOT NULL DEFAULT 'computer_general'");
  }

  const questionColumnMigrations: Array<[string, string]> = [
    ["part", "TEXT NOT NULL DEFAULT ''"],
    ["unit", "TEXT NOT NULL DEFAULT ''"],
    ["topic", "TEXT NOT NULL DEFAULT ''"],
    ["source_asset_id", "TEXT"],
    ["source_page", "INTEGER"],
    ["extraction_confidence", "REAL"],
    ["answer_status", "TEXT NOT NULL DEFAULT 'confirmed'"],
    ["review_status", "TEXT NOT NULL DEFAULT 'pending'"],
  ];

  for (const [column, definition] of questionColumnMigrations) {
    if (!questionColumns.some((current) => current.name === column)) {
      db.exec(`ALTER TABLE questions ADD COLUMN ${column} ${definition}`);
    }
  }

  const newSubjects = EXAM_TYPES.filter(({ id }) =>
    db.prepare("INSERT OR IGNORE INTO subjects (id) VALUES (?)").run(id).changes > 0,
  ).map(({ id }) => id);
  seedQuestions(db, newSubjects);
}

function seedQuestions(db: DatabaseSync, newSubjects: ExamType[]): void {
  const seeds: QuestionDraft[] = [
    {
      examType: "computer_general",
      type: "multiple_choice_4",
      category: "정보처리 기초",
      tags: ["운영체제", "프로세스"],
      difficulty: "기초",
      stem: "운영체제의 주요 역할로 가장 알맞은 것은?",
      choices: ["이미지 보정", "프로세스와 자원 관리", "HTML 문서 작성", "네트워크 케이블 제작"],
      answer: "프로세스와 자원 관리",
      acceptableAnswers: [],
      explanation: "운영체제는 프로세스, 메모리, 파일, 입출력 장치 같은 컴퓨터 자원을 관리한다.",
      sourceType: "manual",
      sourceNote: "MVP 샘플",
    },
    {
      examType: "computer_general",
      type: "multiple_choice_5",
      category: "데이터베이스",
      tags: ["정규화", "관계형 데이터베이스"],
      difficulty: "보통",
      stem: "관계형 데이터베이스에서 중복을 줄이고 이상 현상을 완화하기 위한 설계 과정은?",
      choices: ["인덱싱", "샤딩", "정규화", "캐싱", "직렬화"],
      answer: "정규화",
      acceptableAnswers: [],
      explanation: "정규화는 데이터 중복과 삽입/삭제/갱신 이상을 줄이기 위해 릴레이션을 구조화하는 과정이다.",
      sourceType: "manual",
      sourceNote: "MVP 샘플",
    },
    {
      examType: "computer_general",
      type: "short_answer",
      category: "웹",
      tags: ["HTTP", "상태 코드"],
      difficulty: "기초",
      stem: "HTTP에서 요청이 성공적으로 처리되었음을 의미하는 대표적인 상태 코드는?",
      choices: [],
      answer: "200",
      acceptableAnswers: ["200", "200 OK"],
      explanation: "HTTP 200 OK는 요청이 성공적으로 처리되었음을 나타내는 대표 상태 코드다.",
      sourceType: "manual",
      sourceNote: "MVP 샘플",
    },
    {
      examType: "ncs",
      type: "multiple_choice_4",
      category: "의사소통",
      tags: ["NCS", "문제해결"],
      difficulty: "기초",
      stem: "NCS에서 주어진 정보를 목적에 맞게 해석하고 전달하는 능력과 가장 가까운 것은?",
      choices: ["의사소통능력", "수리능력", "자원관리능력", "조직이해능력"],
      answer: "의사소통능력",
      acceptableAnswers: [],
      explanation: "의사소통능력은 문서와 언어 정보를 정확하게 이해하고 상황에 맞게 표현하는 능력입니다.",
      sourceType: "manual",
      sourceNote: "MVP 샘플",
    },
    {
      examType: "information_security",
      type: "multiple_choice_5",
      category: "접근통제",
      tags: ["정보보호론", "인증"],
      difficulty: "기초",
      stem: "정보보호의 3요소 중 허가된 사용자가 필요한 시점에 정보에 접근할 수 있음을 의미하는 것은?",
      choices: ["기밀성", "무결성", "가용성", "부인방지", "인증"],
      answer: "가용성",
      acceptableAnswers: [],
      explanation: "가용성은 인가된 사용자가 필요할 때 정보와 시스템을 이용할 수 있도록 보장하는 속성입니다.",
      sourceType: "manual",
      sourceNote: "MVP 샘플",
    },
  ];

  for (const seed of seeds) {
    if (!newSubjects.includes(seed.examType)) continue;
    const exists = db
      .prepare("SELECT 1 FROM questions WHERE exam_type = ? LIMIT 1")
      .get(seed.examType);

    if (!exists) {
      insertQuestion(seed, db);
    }
  }
}

function questionFromRow(row: QuestionRow): Question {
  return {
    id: row.id,
    examType: normalizeExamType(row.exam_type),
    type: row.type,
    category: row.category,
    part: row.part || undefined,
    unit: row.unit || undefined,
    topic: row.topic || undefined,
    tags: parseJsonList(row.tags),
    difficulty: row.difficulty,
    stem: row.stem,
    choices: parseJsonList(row.choices),
    answer: row.answer,
    acceptableAnswers: parseJsonList(row.acceptable_answers),
    explanation: row.explanation,
    sourceType: row.source_type,
    sourceNote: row.source_note,
    sourceAssetId: row.source_asset_id || undefined,
    sourcePage: row.source_page || undefined,
    extractionConfidence: row.extraction_confidence ?? undefined,
    answerStatus: row.answer_status || "confirmed",
    reviewStatus: row.review_status || "pending",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function attemptFromRow(row: AttemptRow): Attempt {
  return {
    id: row.id,
    questionId: row.question_id,
    examType: normalizeExamType(row.exam_type),
    selectedAnswer: row.selected_answer,
    isCorrect: row.is_correct === 1,
    elapsedSeconds: row.elapsed_seconds,
    mode: row.mode,
    createdAt: row.created_at,
  };
}

function recentAttemptFromRow(row: AttemptRow): RecentAttempt {
  return {
    ...attemptFromRow(row),
    questionStem: row.question_stem || "",
    category: row.category || "미분류",
  };
}

function wrongNoteFromRow(row: WrongNoteRow): WrongNote {
  return {
    questionId: row.question_id,
    examType: normalizeExamType(row.exam_type),
    wrongCount: row.wrong_count,
    lastWrongAt: row.last_wrong_at,
    resolvedAt: row.resolved_at,
    reasonTags: parseJsonList(row.reason_tags),
    memo: row.memo,
    updatedAt: row.updated_at,
  };
}

export function insertQuestion(question: QuestionDraft, db = getDb()): Question {
  assertSubjectActive(question.examType, db);
  const createdAt = now();
  const id = createId("q");

  db.prepare(`
    INSERT INTO questions (
      id, exam_type, type, category, part, unit, topic, tags, difficulty, stem, choices, answer,
      acceptable_answers, explanation, source_type, source_note, source_asset_id,
      source_page, extraction_confidence, answer_status, review_status, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    question.examType,
    question.type,
    question.category,
    question.part || "",
    question.unit || "",
    question.topic || "",
    JSON.stringify(question.tags),
    question.difficulty,
    question.stem,
    JSON.stringify(question.choices),
    question.answer,
    JSON.stringify(question.acceptableAnswers),
    question.explanation,
    question.sourceType,
    question.sourceNote,
    question.sourceAssetId || null,
    question.sourcePage || null,
    question.extractionConfidence ?? null,
    question.answerStatus || "confirmed",
    question.reviewStatus || "pending",
    createdAt,
    createdAt,
  );

  return getQuestionById(id, db)!;
}

export function getQuestionById(id: string, db = getDb()): Question | null {
  const row = db.prepare("SELECT * FROM questions WHERE id = ?").get(id) as
    | QuestionRow
    | undefined;

  return row ? questionFromRow(row) : null;
}

export function listQuestions(examType: ExamType, db = getDb()): Question[] {
  const rows = db
    .prepare("SELECT * FROM questions WHERE exam_type = ? ORDER BY created_at DESC")
    .all(examType) as QuestionRow[];

  return rows.map(questionFromRow);
}

export function listAttempts(examType: ExamType, db = getDb()): Attempt[] {
  const rows = db
    .prepare(`
      SELECT attempts.*, questions.exam_type
      FROM attempts
      INNER JOIN questions ON questions.id = attempts.question_id
      WHERE questions.exam_type = ?
      ORDER BY attempts.created_at DESC, attempts.rowid DESC
    `)
    .all(examType) as AttemptRow[];

  return rows.map(attemptFromRow);
}

export function listWrongNotes(examType: ExamType, db = getDb()): WrongNote[] {
  const rows = db
    .prepare(`
      SELECT wrong_notes.*, questions.exam_type
      FROM wrong_notes
      INNER JOIN questions ON questions.id = wrong_notes.question_id
      WHERE questions.exam_type = ?
      ORDER BY resolved_at IS NOT NULL, last_wrong_at DESC
    `)
    .all(examType) as WrongNoteRow[];

  return rows.map(wrongNoteFromRow);
}

export function recordAttempt(input: {
  questionId: string;
  selectedAnswer: string;
  elapsedSeconds: number;
  mode?: AttemptMode;
}): Attempt {
  const db = getDb();
  const question = getQuestionById(input.questionId, db);

  if (!question) {
    throw new Error("문제를 찾을 수 없습니다.");
  }

  const createdAt = now();
  const isCorrect = evaluateAnswer(question, input.selectedAnswer);
  const attemptId = createId("a");

  db.prepare(`
    INSERT INTO attempts (
      id, question_id, selected_answer, is_correct, elapsed_seconds, mode, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    attemptId,
    question.id,
    input.selectedAnswer,
    isCorrect ? 1 : 0,
    Math.max(0, Math.round(input.elapsedSeconds || 0)),
    input.mode || "practice",
    createdAt,
  );

  if (isCorrect) {
    db.prepare(`
      UPDATE wrong_notes
      SET resolved_at = COALESCE(resolved_at, ?), updated_at = ?
      WHERE question_id = ? AND resolved_at IS NULL
    `).run(createdAt, createdAt, question.id);
  } else {
    db.prepare(`
      INSERT INTO wrong_notes (
        question_id, wrong_count, last_wrong_at, resolved_at, reason_tags, memo, updated_at
      )
      VALUES (?, 1, ?, NULL, '[]', '', ?)
      ON CONFLICT(question_id) DO UPDATE SET
        wrong_count = wrong_count + 1,
        last_wrong_at = excluded.last_wrong_at,
        resolved_at = NULL,
        updated_at = excluded.updated_at
    `).run(question.id, createdAt, createdAt);
  }

  return attemptFromRow(
    db.prepare(`
      SELECT attempts.*, questions.exam_type
      FROM attempts
      INNER JOIN questions ON questions.id = attempts.question_id
      WHERE attempts.id = ?
    `).get(attemptId) as AttemptRow,
  );
}

export function submitExam(input: ExamSubmission): Attempt[] {
  const db = getDb();
  const payload = JSON.stringify(input.responses);
  db.exec("BEGIN IMMEDIATE");
  try {
    const existing = db.prepare("SELECT payload, results FROM exam_submissions WHERE id = ?").get(input.submissionId) as { payload: string; results: string } | undefined;
    if (existing) {
      if (existing.payload !== payload) throw new Error("이미 제출한 시험의 답안을 변경할 수 없습니다.");
      db.exec("COMMIT");
      return JSON.parse(existing.results) as Attempt[];
    }
    const questions = input.responses.map((response) => getQuestionById(response.questionId, db));
    if (questions.some((question) => !question)) throw new Error("문제를 찾을 수 없습니다.");
    if (new Set(input.responses.map((response) => response.questionId)).size !== questions.length) {
      throw new Error("중복 문항은 제출할 수 없습니다.");
    }
    if (new Set(questions.map((question) => question!.examType)).size !== 1) {
      throw new Error("같은 시험 종류의 문항만 제출할 수 있습니다.");
    }
    const attempts = input.responses.map((response) => recordAttempt({ ...response, mode: "exam" }));
    db.prepare("INSERT INTO exam_submissions (id, payload, results, created_at) VALUES (?, ?, ?, ?)")
      .run(input.submissionId, payload, JSON.stringify(attempts), now());
    db.exec("COMMIT");
    return attempts;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function updateWrongNote(input: {
  questionId: string;
  reasonTags: string[];
  memo: string;
}): WrongNote {
  const db = getDb();
  const updatedAt = now();

  db.prepare(`
    INSERT INTO wrong_notes (
      question_id, wrong_count, last_wrong_at, resolved_at, reason_tags, memo, updated_at
    )
    VALUES (?, 0, ?, NULL, ?, ?, ?)
    ON CONFLICT(question_id) DO UPDATE SET
      reason_tags = excluded.reason_tags,
      memo = excluded.memo,
      updated_at = excluded.updated_at
  `).run(
    input.questionId,
    updatedAt,
    JSON.stringify(input.reasonTags),
    input.memo,
    updatedAt,
  );

  const row = db
    .prepare(`
      SELECT wrong_notes.*, questions.exam_type
      FROM wrong_notes
      INNER JOIN questions ON questions.id = wrong_notes.question_id
      WHERE wrong_notes.question_id = ?
    `)
    .get(input.questionId) as WrongNoteRow;

  return wrongNoteFromRow(row);
}

export function getAppState(examType: ExamType = "ncs"): AppState {
  const db = getDb();
  const subjects = listSubjects(db);
  if (!subjects.some(subject => subject.id === examType && subject.active)) {
    examType = subjects.find(subject => subject.active)?.id || "ncs";
  }
  const questions = listQuestions(examType, db);
  const attempts = listAttempts(examType, db);
  const wrongNotes = listWrongNotes(examType, db);
  const recentAttempts = db
    .prepare(`
      SELECT
        attempts.*,
        questions.stem AS question_stem,
        questions.category AS category,
        questions.exam_type
      FROM attempts
      INNER JOIN questions ON questions.id = attempts.question_id
      WHERE questions.exam_type = ?
      ORDER BY attempts.created_at DESC, attempts.rowid DESC
      LIMIT 8
    `)
    .all(examType) as AttemptRow[];

  return {
    subjects,
    examType,
    questions,
    attempts,
    wrongNotes,
    recentAttempts: recentAttempts.map(recentAttemptFromRow),
    stats: buildStats(questions, attempts, wrongNotes),
    env: getEnvStatus(),
  };
}

function buildStats(
  questions: Question[],
  attempts: Attempt[],
  wrongNotes: WrongNote[],
): AppState["stats"] {
  const correctAttempts = attempts.filter((attempt) => attempt.isCorrect).length;
  const byQuestion = new Map(questions.map((question) => [question.id, question]));
  const byCategory = new Map<string, { total: number; correct: number }>();

  for (const attempt of attempts) {
    const question = byQuestion.get(attempt.questionId);
    const category = question?.category || "미분류";
    const current = byCategory.get(category) || { total: 0, correct: 0 };
    current.total += 1;
    current.correct += attempt.isCorrect ? 1 : 0;
    byCategory.set(category, current);
  }

  const categories: CategoryStat[] = Array.from(byCategory.entries()).map(
    ([category, stat]) => ({
      category,
      total: stat.total,
      correct: stat.correct,
      accuracy: stat.total === 0 ? 0 : Math.round((stat.correct / stat.total) * 100),
    }),
  );

  return {
    totalQuestions: questions.length,
    totalAttempts: attempts.length,
    correctAttempts,
    accuracy:
      attempts.length === 0 ? 0 : Math.round((correctAttempts / attempts.length) * 100),
    openWrongNotes: wrongNotes.filter((note) => !note.resolvedAt).length,
    categories,
  };
}

function getEnvStatus(): EnvStatus {
  const configured = (key: string) => {
    const value = process.env[key]?.trim();
    return Boolean(value && !value.startsWith("your_") && value !== "changeme");
  };
  return {
    openaiConfigured: configured("OPENAI_API_KEY"),
    geminiConfigured: configured("GEMINI_API_KEY"),
    anthropicConfigured: configured("ANTHROPIC_API_KEY"),
    openaiModel: process.env.OPENAI_MODEL || AI_PROVIDERS[0].model,
    geminiModel: process.env.GEMINI_MODEL || AI_PROVIDERS[1].model,
    anthropicModel: process.env.ANTHROPIC_MODEL || AI_PROVIDERS[2].model,
    defaultProvider: resolveProvider(process.env.AI_DEFAULT_PROVIDER),
  };
}

export function listSubjects(db = getDb()): SubjectSummary[] {
  return EXAM_TYPES.map(({ id, label }) => ({
    id, label,
    active: Boolean((db.prepare("SELECT active FROM subjects WHERE id = ?").get(id) as { active: number }).active),
    questions: Number((db.prepare("SELECT COUNT(*) AS n FROM questions WHERE exam_type = ?").get(id) as { n: number }).n),
    attempts: Number((db.prepare("SELECT COUNT(*) AS n FROM attempts a JOIN questions q ON q.id = a.question_id WHERE q.exam_type = ?").get(id) as { n: number }).n),
    wrongNotes: Number((db.prepare("SELECT COUNT(*) AS n FROM wrong_notes w JOIN questions q ON q.id = w.question_id WHERE q.exam_type = ?").get(id) as { n: number }).n),
  }));
}

export function assertSubjectActive(id: ExamType, db = getDb()): void {
  if (!(db.prepare("SELECT active FROM subjects WHERE id = ?").get(id) as { active: number } | undefined)?.active) {
    throw new Error("삭제된 과목입니다. 과목 관리에서 다시 추가해 주세요.");
  }
}

export function restoreSubject(id: ExamType): void {
  getDb().prepare("UPDATE subjects SET active = 1 WHERE id = ?").run(id);
}

export function deleteSubject(id: ExamType, expected: Pick<SubjectSummary, "questions" | "attempts" | "wrongNotes">): void {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const subject = listSubjects(db).find(item => item.id === id)!;
    if (!subject.active) throw new Error("이미 삭제된 과목입니다.");
    if (subject.questions !== expected.questions || subject.attempts !== expected.attempts || subject.wrongNotes !== expected.wrongNotes) {
      throw new Error("과목 데이터가 변경되었습니다. 새로고침 후 삭제 범위를 다시 확인해 주세요.");
    }
    db.prepare("DELETE FROM exam_submissions WHERE EXISTS (SELECT 1 FROM json_each(exam_submissions.results) WHERE json_extract(value, '$.examType') = ?)").run(id);
    db.prepare("DELETE FROM wrong_notes WHERE question_id IN (SELECT id FROM questions WHERE exam_type = ?)").run(id);
    db.prepare("DELETE FROM attempts WHERE question_id IN (SELECT id FROM questions WHERE exam_type = ?)").run(id);
    db.prepare("DELETE FROM questions WHERE exam_type = ?").run(id);
    db.prepare("UPDATE subjects SET active = 0 WHERE id = ?").run(id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function evaluateAnswer(question: Question, selectedAnswer: string): boolean {
  const selected = normalizeForCompare(selectedAnswer);
  const accepted = [question.answer, ...question.acceptableAnswers]
    .map(normalizeForCompare)
    .filter(Boolean);

  if (accepted.includes(selected)) {
    return true;
  }

  if (question.type === "short_answer") {
    return false;
  }

  const selectedIndex = question.choices.findIndex(
    (choice) => normalizeForCompare(choice) === selected,
  );
  const numericAnswer = Number.parseInt(question.answer, 10);

  return Number.isInteger(numericAnswer) && selectedIndex === numericAnswer - 1;
}
