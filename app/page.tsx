"use client";

import {
  BadgeCheck,
  BookOpen,
  Brain,
  Check,
  CircleDot,
  ClipboardList,
  FileSpreadsheet,
  History,
  LibraryBig,
  Loader2,
  NotebookTabs,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import type { AppState, Question, QuestionDraft, QuestionType, WrongNote } from "@/lib/types";
import {
  getChoiceCount,
  getQuestionTypeLabel,
  normalizeQuestionType,
  validateQuestionDraft,
} from "@/lib/validation";

type ViewKey = "dashboard" | "practice" | "wrong" | "bank" | "import" | "ai";

type ManualForm = {
  type: QuestionType;
  category: string;
  difficulty: string;
  stem: string;
  choices: string[];
  answer: string;
  acceptableAnswers: string;
  explanation: string;
  tags: string;
};

type ImportPreview = {
  rowNumber: number;
  question: QuestionDraft;
  errors: string[];
};

type AiForm = {
  provider: "openai" | "gemini";
  type: QuestionType;
  category: string;
  difficulty: string;
  count: number;
  instruction: string;
  baseQuestionId: string;
};

const emptyManualForm: ManualForm = {
  type: "multiple_choice_4",
  category: "정보처리 기초",
  difficulty: "보통",
  stem: "",
  choices: ["", "", "", "", ""],
  answer: "",
  acceptableAnswers: "",
  explanation: "",
  tags: "",
};

const navItems: Array<{
  key: ViewKey;
  label: string;
  icon: typeof ClipboardList;
}> = [
  { key: "dashboard", label: "대시보드", icon: ClipboardList },
  { key: "practice", label: "문제 풀이", icon: BookOpen },
  { key: "wrong", label: "오답노트", icon: NotebookTabs },
  { key: "bank", label: "문제 관리", icon: LibraryBig },
  { key: "import", label: "엑셀 가져오기", icon: FileSpreadsheet },
  { key: "ai", label: "AI 생성", icon: Sparkles },
];

export default function Home() {
  const [state, setState] = useState<AppState | null>(null);
  const [view, setView] = useState<ViewKey>("dashboard");
  const [activeQuestionId, setActiveQuestionId] = useState("");
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [answered, setAnswered] = useState<null | { isCorrect: boolean; answer: string }>(null);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [manualForm, setManualForm] = useState<ManualForm>(emptyManualForm);
  const [importPreview, setImportPreview] = useState<ImportPreview[]>([]);
  const [generatedQuestions, setGeneratedQuestions] = useState<QuestionDraft[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiForm, setAiForm] = useState<AiForm>({
    provider: "openai",
    type: "multiple_choice_4",
    category: "정보처리 기초",
    difficulty: "보통",
    count: 3,
    instruction: "",
    baseQuestionId: "",
  });

  useEffect(() => {
    void loadState();
  }, []);

  useEffect(() => {
    if (!state || activeQuestionId) {
      return;
    }

    setActiveQuestionId(state.questions[0]?.id || "");
  }, [activeQuestionId, state]);

  const activeQuestion = useMemo(
    () => state?.questions.find((question) => question.id === activeQuestionId) || null,
    [activeQuestionId, state],
  );

  const filteredQuestions = useMemo(() => {
    if (!state) {
      return [];
    }

    const term = searchTerm.trim().toLowerCase();

    if (!term) {
      return state.questions;
    }

    return state.questions.filter((question) =>
      [
        question.stem,
        question.category,
        question.difficulty,
        question.sourceType,
        ...question.tags,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [searchTerm, state]);

  async function loadState() {
    const response = await fetch("/api/state", { cache: "no-store" });
    const nextState = (await response.json()) as AppState;
    setState(nextState);
    setAiForm((current) => ({
      ...current,
      provider: nextState.env.defaultProvider,
    }));
  }

  function chooseQuestion(questionId: string) {
    setActiveQuestionId(questionId);
    setSelectedAnswer("");
    setAnswered(null);
    setStartedAt(Date.now());
  }

  async function submitAnswer() {
    if (!activeQuestion || !selectedAnswer) {
      return;
    }

    setBusy(true);
    setStatusMessage("");

    try {
      const response = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: activeQuestion.id,
          selectedAnswer,
          elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
          mode: view === "wrong" ? "review" : "practice",
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "채점에 실패했습니다.");
      }

      setState(payload.state);
      setAnswered({ isCorrect: payload.attempt.isCorrect, answer: activeQuestion.answer });
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "채점에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function saveManualQuestion() {
    const validation = validateQuestionDraft({
      ...manualForm,
      tags: manualForm.tags,
      acceptableAnswers: manualForm.acceptableAnswers,
      sourceType: "manual",
      sourceNote: "수동 등록",
    });

    if (!validation.ok) {
      setStatusMessage(validation.errors.join(" "));
      return;
    }

    await saveQuestions([validation.question], "문제를 저장했습니다.");
    setManualForm(emptyManualForm);
  }

  async function saveQuestions(questions: QuestionDraft[], successMessage: string) {
    setBusy(true);
    setStatusMessage("");

    try {
      const response = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.errors?.join(" ") || "문제 저장에 실패했습니다.");
      }

      setState(payload.state);
      setStatusMessage(successMessage);

      if (payload.questions?.[0]?.id) {
        setActiveQuestionId(payload.questions[0].id);
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "문제 저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleExcelFile(file: File | null) {
    if (!file) {
      return;
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    const preview = rows.map((row, index) => {
      const validation = validateQuestionDraft({
        type: normalizeQuestionType(row.type),
        category: row.category,
        stem: row.question || row.stem,
        choices: [row.choice_1, row.choice_2, row.choice_3, row.choice_4, row.choice_5]
          .map((value) => String(value || "").trim())
          .filter(Boolean),
        answer: row.answer,
        explanation: row.explanation,
        tags: row.tags,
        difficulty: row.difficulty,
        sourceType: "excel_import",
        sourceNote: file.name,
      });

      return {
        rowNumber: index + 2,
        question: validation.question,
        errors: validation.errors,
      };
    });

    setImportPreview(preview);
    setStatusMessage(`${preview.length}개 행을 읽었습니다.`);
  }

  async function saveImportedQuestions() {
    const valid = importPreview
      .filter((item) => item.errors.length === 0)
      .map((item) => item.question);

    if (valid.length === 0) {
      setStatusMessage("저장할 수 있는 행이 없습니다.");
      return;
    }

    await saveQuestions(valid, `${valid.length}개 문제를 가져왔습니다.`);
    setImportPreview([]);
  }

  async function generateAiQuestions() {
    setBusy(true);
    setGeneratedQuestions([]);
    setStatusMessage("");

    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiForm),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "AI 문제 생성에 실패했습니다.");
      }

      setGeneratedQuestions(payload.questions || []);
      setStatusMessage(
        payload.errors?.length
          ? `검증 제외 항목이 있습니다: ${payload.errors.join(" ")}`
          : `${payload.questions?.length || 0}개 문제를 생성했습니다.`,
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "AI 문제 생성에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function updateWrongNote(questionId: string, updates: Partial<WrongNote>) {
    const current = state?.wrongNotes.find((note) => note.questionId === questionId);

    const response = await fetch("/api/wrong-notes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId,
        reasonTags: updates.reasonTags || current?.reasonTags || [],
        memo: updates.memo ?? current?.memo ?? "",
      }),
    });
    const payload = await response.json();
    setState(payload.state);
  }

  function setSimilarGeneration(question: Question) {
    setAiForm((current) => ({
      ...current,
      type: question.type,
      category: question.category,
      difficulty: question.difficulty,
      baseQuestionId: question.id,
      instruction: "기준 문제와 같은 개념을 다루되 지문과 보기를 새롭게 구성",
    }));
    setGeneratedQuestions([]);
    setView("ai");
  }

  if (!state) {
    return (
      <main className="loading-screen">
        <Loader2 className="spin" size={24} />
        <span>cbt_vibe</span>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">cv</span>
          <div>
            <strong>cbt_vibe</strong>
            <span>local study</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="주요 메뉴">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.key}
                className={view === item.key ? "nav-item active" : "nav-item"}
                onClick={() => setView(item.key)}
                type="button"
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="provider-box">
          <div className="provider-row">
            <CircleDot size={14} />
            <span>OpenAI</span>
            <b className={state.env.openaiConfigured ? "ok" : ""}>
              {state.env.openaiConfigured ? "ON" : "OFF"}
            </b>
          </div>
          <div className="provider-row">
            <CircleDot size={14} />
            <span>Gemini</span>
            <b className={state.env.geminiConfigured ? "ok" : ""}>
              {state.env.geminiConfigured ? "ON" : "OFF"}
            </b>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">AI CBT MVP</p>
            <h1>{navItems.find((item) => item.key === view)?.label}</h1>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={16} />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="검색"
              />
            </label>
            <button className="icon-button" onClick={() => void loadState()} title="새로고침" type="button">
              <RefreshCw size={17} />
            </button>
            <button className="icon-button" title="설정" type="button">
              <Settings size={17} />
            </button>
          </div>
        </header>

        {statusMessage ? (
          <div className="toast" role="status">
            {statusMessage}
            <button onClick={() => setStatusMessage("")} type="button" title="닫기">
              <X size={14} />
            </button>
          </div>
        ) : null}

        {view === "dashboard" ? (
          <DashboardView state={state} onStart={() => setView("practice")} />
        ) : null}

        {view === "practice" ? (
          <PracticeView
            activeQuestion={activeQuestion}
            answered={answered}
            busy={busy}
            filteredQuestions={filteredQuestions}
            onChoose={chooseQuestion}
            onGenerateSimilar={setSimilarGeneration}
            onSubmit={() => void submitAnswer()}
            selectedAnswer={selectedAnswer}
            setSelectedAnswer={setSelectedAnswer}
          />
        ) : null}

        {view === "wrong" ? (
          <WrongNotesView
            questions={state.questions}
            wrongNotes={state.wrongNotes}
            onChoose={(questionId) => {
              chooseQuestion(questionId);
              setView("practice");
            }}
            onGenerateSimilar={setSimilarGeneration}
            onUpdate={(questionId, updates) => void updateWrongNote(questionId, updates)}
          />
        ) : null}

        {view === "bank" ? (
          <QuestionBankView
            busy={busy}
            filteredQuestions={filteredQuestions}
            form={manualForm}
            onChoose={(questionId) => {
              chooseQuestion(questionId);
              setView("practice");
            }}
            onSave={() => void saveManualQuestion()}
            setForm={setManualForm}
          />
        ) : null}

        {view === "import" ? (
          <ImportView
            busy={busy}
            preview={importPreview}
            onFile={(file) => void handleExcelFile(file)}
            onSave={() => void saveImportedQuestions()}
          />
        ) : null}

        {view === "ai" ? (
          <AiGenerateView
            busy={busy}
            env={state.env}
            form={aiForm}
            generatedQuestions={generatedQuestions}
            questions={state.questions}
            onGenerate={() => void generateAiQuestions()}
            onSave={() => void saveQuestions(generatedQuestions, `${generatedQuestions.length}개 문제를 저장했습니다.`)}
            setForm={setAiForm}
          />
        ) : null}
      </section>
    </main>
  );
}

function DashboardView({ state, onStart }: { state: AppState; onStart: () => void }) {
  return (
    <div className="content-grid dashboard-grid">
      <section className="panel hero-panel">
        <div>
          <p className="eyebrow">오늘의 학습</p>
          <h2>기록이 쌓일수록 오답 흐름이 선명해집니다.</h2>
        </div>
        <button className="primary-button" onClick={onStart} type="button">
          <BookOpen size={18} />
          이어서 풀기
        </button>
      </section>

      <section className="metrics">
        <Metric label="문제" value={`${state.stats.totalQuestions}`} />
        <Metric label="풀이" value={`${state.stats.totalAttempts}`} />
        <Metric label="정답률" value={`${state.stats.accuracy}%`} />
        <Metric label="오답" value={`${state.stats.openWrongNotes}`} />
      </section>

      <section className="panel">
        <PanelHeader title="최근 풀이" icon={History} />
        <div className="list-table">
          {state.recentAttempts.length === 0 ? (
            <EmptyLine label="풀이 기록 없음" />
          ) : (
            state.recentAttempts.map((attempt) => (
              <div className="table-row" key={attempt.id}>
                <span className={attempt.isCorrect ? "dot correct" : "dot wrong"} />
                <strong>{attempt.questionStem}</strong>
                <span>{attempt.category}</span>
                <b>{attempt.isCorrect ? "정답" : "오답"}</b>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="panel">
        <PanelHeader title="카테고리" icon={BadgeCheck} />
        <div className="category-stack">
          {state.stats.categories.length === 0 ? (
            <EmptyLine label="카테고리 기록 없음" />
          ) : (
            state.stats.categories.map((category) => (
              <div className="category-row" key={category.category}>
                <span>{category.category}</span>
                <div className="meter">
                  <i style={{ width: `${category.accuracy}%` }} />
                </div>
                <b>{category.accuracy}%</b>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function PracticeView({
  activeQuestion,
  answered,
  busy,
  filteredQuestions,
  onChoose,
  onGenerateSimilar,
  onSubmit,
  selectedAnswer,
  setSelectedAnswer,
}: {
  activeQuestion: Question | null;
  answered: null | { isCorrect: boolean; answer: string };
  busy: boolean;
  filteredQuestions: Question[];
  onChoose: (questionId: string) => void;
  onGenerateSimilar: (question: Question) => void;
  onSubmit: () => void;
  selectedAnswer: string;
  setSelectedAnswer: (answer: string) => void;
}) {
  return (
    <div className="practice-layout">
      <section className="panel question-panel">
        {activeQuestion ? (
          <>
            <div className="question-meta">
              <Badge>{getQuestionTypeLabel(activeQuestion.type)}</Badge>
              <Badge>{activeQuestion.category}</Badge>
              <Badge>{activeQuestion.difficulty}</Badge>
            </div>
            <h2 className="question-stem">{activeQuestion.stem}</h2>

            {activeQuestion.type === "short_answer" ? (
              <label className="answer-input">
                <span>답안</span>
                <input
                  value={selectedAnswer}
                  onChange={(event) => setSelectedAnswer(event.target.value)}
                  placeholder="정답 입력"
                />
              </label>
            ) : (
              <div className="choice-list">
                {activeQuestion.choices.map((choice, index) => (
                  <button
                    className={selectedAnswer === choice ? "choice selected" : "choice"}
                    key={choice}
                    onClick={() => setSelectedAnswer(choice)}
                    type="button"
                  >
                    <span>{index + 1}</span>
                    <b>{choice}</b>
                  </button>
                ))}
              </div>
            )}

            {answered ? (
              <div className={answered.isCorrect ? "result-box correct" : "result-box wrong"}>
                <strong>{answered.isCorrect ? "정답" : "오답"}</strong>
                <span>정답: {answered.answer}</span>
                {activeQuestion.explanation ? <p>{activeQuestion.explanation}</p> : null}
              </div>
            ) : null}

            <div className="action-row">
              <button
                className="primary-button"
                disabled={!selectedAnswer || busy}
                onClick={onSubmit}
                type="button"
              >
                {busy ? <Loader2 className="spin" size={18} /> : <Check size={18} />}
                채점
              </button>
              <button className="utility-button" onClick={() => onGenerateSimilar(activeQuestion)} type="button">
                <Sparkles size={17} />
                유사 문제
              </button>
            </div>
          </>
        ) : (
          <EmptyLine label="문제 없음" />
        )}
      </section>

      <aside className="panel question-list-panel">
        <PanelHeader title="문제 목록" icon={LibraryBig} />
        <div className="question-list">
          {filteredQuestions.map((question) => (
            <button
              className={question.id === activeQuestion?.id ? "question-list-item active" : "question-list-item"}
              key={question.id}
              onClick={() => onChoose(question.id)}
              type="button"
            >
              <span>{question.category}</span>
              <strong>{question.stem}</strong>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}

function WrongNotesView({
  questions,
  wrongNotes,
  onChoose,
  onGenerateSimilar,
  onUpdate,
}: {
  questions: Question[];
  wrongNotes: WrongNote[];
  onChoose: (questionId: string) => void;
  onGenerateSimilar: (question: Question) => void;
  onUpdate: (questionId: string, updates: Partial<WrongNote>) => void;
}) {
  return (
    <section className="panel full-panel">
      <PanelHeader title="오답노트" icon={NotebookTabs} />
      <div className="wrong-list">
        {wrongNotes.length === 0 ? (
          <EmptyLine label="오답 기록 없음" />
        ) : (
          wrongNotes.map((note) => {
            const question = questions.find((item) => item.id === note.questionId);

            if (!question) {
              return null;
            }

            return (
              <article className="wrong-row" key={note.questionId}>
                <div>
                  <div className="question-meta">
                    <Badge>{question.category}</Badge>
                    <Badge>{note.resolvedAt ? "해결" : "복습"}</Badge>
                    <Badge>{`${note.wrongCount}회`}</Badge>
                  </div>
                  <h3>{question.stem}</h3>
                  <textarea
                    value={note.memo}
                    onChange={(event) => onUpdate(note.questionId, { memo: event.target.value })}
                    placeholder="오답 메모"
                  />
                </div>
                <div className="row-actions">
                  <button className="utility-button" onClick={() => onChoose(question.id)} type="button">
                    <BookOpen size={16} />
                    풀기
                  </button>
                  <button className="utility-button" onClick={() => onGenerateSimilar(question)} type="button">
                    <Sparkles size={16} />
                    확장
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function QuestionBankView({
  busy,
  filteredQuestions,
  form,
  onChoose,
  onSave,
  setForm,
}: {
  busy: boolean;
  filteredQuestions: Question[];
  form: ManualForm;
  onChoose: (questionId: string) => void;
  onSave: () => void;
  setForm: (form: ManualForm) => void;
}) {
  const choiceCount = getChoiceCount(form.type);

  return (
    <div className="bank-layout">
      <section className="panel">
        <PanelHeader title="문제 등록" icon={Plus} />
        <div className="form-grid">
          <SelectField
            label="유형"
            value={form.type}
            onChange={(value) => setForm({ ...form, type: value as QuestionType })}
            options={[
              ["multiple_choice_4", "4지선다형"],
              ["multiple_choice_5", "5지선다형"],
              ["short_answer", "단답형"],
            ]}
          />
          <TextField
            label="카테고리"
            value={form.category}
            onChange={(value) => setForm({ ...form, category: value })}
          />
          <TextField
            label="난이도"
            value={form.difficulty}
            onChange={(value) => setForm({ ...form, difficulty: value })}
          />
          <TextField
            label="태그"
            value={form.tags}
            onChange={(value) => setForm({ ...form, tags: value })}
          />
        </div>
        <label className="field span-all">
          <span>문제 지문</span>
          <textarea
            value={form.stem}
            onChange={(event) => setForm({ ...form, stem: event.target.value })}
          />
        </label>

        {choiceCount > 0 ? (
          <div className="choice-editor">
            {Array.from({ length: choiceCount }).map((_, index) => (
              <TextField
                key={index}
                label={`보기 ${index + 1}`}
                value={form.choices[index] || ""}
                onChange={(value) => {
                  const choices = [...form.choices];
                  choices[index] = value;
                  setForm({ ...form, choices });
                }}
              />
            ))}
          </div>
        ) : null}

        <div className="form-grid">
          <TextField
            label="정답"
            value={form.answer}
            onChange={(value) => setForm({ ...form, answer: value })}
          />
          <TextField
            label="허용 정답"
            value={form.acceptableAnswers}
            onChange={(value) => setForm({ ...form, acceptableAnswers: value })}
          />
        </div>

        <label className="field span-all">
          <span>해설</span>
          <textarea
            value={form.explanation}
            onChange={(event) => setForm({ ...form, explanation: event.target.value })}
          />
        </label>

        <div className="action-row">
          <button className="primary-button" disabled={busy} onClick={onSave} type="button">
            {busy ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
            저장
          </button>
        </div>
      </section>

      <section className="panel">
        <PanelHeader title="문제 은행" icon={LibraryBig} />
        <div className="question-list tall">
          {filteredQuestions.map((question) => (
            <button className="question-list-item" key={question.id} onClick={() => onChoose(question.id)} type="button">
              <span>{`${getQuestionTypeLabel(question.type)} · ${question.category}`}</span>
              <strong>{question.stem}</strong>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function ImportView({
  busy,
  preview,
  onFile,
  onSave,
}: {
  busy: boolean;
  preview: ImportPreview[];
  onFile: (file: File | null) => void;
  onSave: () => void;
}) {
  const validCount = preview.filter((item) => item.errors.length === 0).length;

  return (
    <section className="panel full-panel">
      <PanelHeader title="엑셀 가져오기" icon={FileSpreadsheet} />
      <label className="upload-zone">
        <FileSpreadsheet size={22} />
        <span>xlsx 파일 선택</span>
        <input
          accept=".xlsx,.xls"
          onChange={(event) => onFile(event.target.files?.[0] || null)}
          type="file"
        />
      </label>

      <div className="preview-toolbar">
        <span>{`검증 통과 ${validCount} / ${preview.length}`}</span>
        <button className="primary-button" disabled={validCount === 0 || busy} onClick={onSave} type="button">
          {busy ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
          저장
        </button>
      </div>

      <div className="import-table">
        {preview.length === 0 ? (
          <EmptyLine label="가져오기 대기" />
        ) : (
          preview.map((item) => (
            <div className={item.errors.length ? "import-row invalid" : "import-row"} key={item.rowNumber}>
              <b>{item.rowNumber}</b>
              <span>{getQuestionTypeLabel(item.question.type)}</span>
              <strong>{item.question.stem || "빈 지문"}</strong>
              <em>{item.errors.length ? item.errors.join(" ") : "OK"}</em>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function AiGenerateView({
  busy,
  env,
  form,
  generatedQuestions,
  questions,
  onGenerate,
  onSave,
  setForm,
}: {
  busy: boolean;
  env: AppState["env"];
  form: AiForm;
  generatedQuestions: QuestionDraft[];
  questions: Question[];
  onGenerate: () => void;
  onSave: () => void;
  setForm: (form: AiForm) => void;
}) {
  return (
    <div className="ai-layout">
      <section className="panel">
        <PanelHeader title="AI 생성" icon={Brain} />
        <div className="form-grid">
          <SelectField
            label="Provider"
            value={form.provider}
            onChange={(value) => setForm({ ...form, provider: value as "openai" | "gemini" })}
            options={[
              ["openai", `OpenAI · ${env.openaiModel}`],
              ["gemini", `Gemini · ${env.geminiModel}`],
            ]}
          />
          <SelectField
            label="유형"
            value={form.type}
            onChange={(value) => setForm({ ...form, type: value as QuestionType })}
            options={[
              ["multiple_choice_4", "4지선다형"],
              ["multiple_choice_5", "5지선다형"],
              ["short_answer", "단답형"],
            ]}
          />
          <TextField
            label="카테고리"
            value={form.category}
            onChange={(value) => setForm({ ...form, category: value })}
          />
          <TextField
            label="난이도"
            value={form.difficulty}
            onChange={(value) => setForm({ ...form, difficulty: value })}
          />
          <label className="field">
            <span>개수</span>
            <input
              max={10}
              min={1}
              type="number"
              value={form.count}
              onChange={(event) => setForm({ ...form, count: Number(event.target.value) })}
            />
          </label>
          <SelectField
            label="기준 문제"
            value={form.baseQuestionId}
            onChange={(value) => setForm({ ...form, baseQuestionId: value })}
            options={[
              ["", "없음"],
              ...questions
                .slice(0, 30)
                .map((question): [string, string] => [question.id, question.stem.slice(0, 36)]),
            ]}
          />
        </div>

        <label className="field span-all">
          <span>요청</span>
          <textarea
            value={form.instruction}
            onChange={(event) => setForm({ ...form, instruction: event.target.value })}
          />
        </label>

        <div className="action-row">
          <button className="primary-button" disabled={busy} onClick={onGenerate} type="button">
            {busy ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
            생성
          </button>
          <button
            className="utility-button"
            disabled={generatedQuestions.length === 0 || busy}
            onClick={onSave}
            type="button"
          >
            <Save size={17} />
            저장
          </button>
        </div>
      </section>

      <section className="panel">
        <PanelHeader title="검수 목록" icon={ClipboardList} />
        <div className="generated-list">
          {generatedQuestions.length === 0 ? (
            <EmptyLine label="생성 결과 없음" />
          ) : (
            generatedQuestions.map((question, index) => (
              <article className="generated-row" key={`${question.stem}-${index}`}>
                <div className="question-meta">
                  <Badge>{getQuestionTypeLabel(question.type)}</Badge>
                  <Badge>{question.category}</Badge>
                  <Badge>{question.difficulty}</Badge>
                </div>
                <h3>{question.stem}</h3>
                {question.choices.length ? (
                  <ol>
                    {question.choices.map((choice) => (
                      <li key={choice}>{choice}</li>
                    ))}
                  </ol>
                ) : null}
                <p>
                  <b>정답</b> {question.answer}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PanelHeader({ title, icon: Icon }: { title: string; icon: typeof ClipboardList }) {
  return (
    <div className="panel-header">
      <div>
        <Icon size={18} />
        <h2>{title}</h2>
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="badge">{children}</span>;
}

function EmptyLine({ label }: { label: string }) {
  return <div className="empty-line">{label}</div>;
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}
