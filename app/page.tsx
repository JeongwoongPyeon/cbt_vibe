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
      <main className="flex min-h-screen items-center justify-center gap-3 text-ink-secondary">
        <Loader2 className="animate-spin" size={24} />
        <span>cbt_vibe</span>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen grid-cols-[260px_minmax(0,1fr)] max-[1100px]:grid-cols-1">
      <aside className="flex flex-col gap-6 border-r border-hairline bg-surface p-[18px_14px] max-[1100px]:sticky max-[1100px]:top-0 max-[1100px]:z-10 max-[1100px]:border-b max-[1100px]:border-r-0">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <span className="flex size-[34px] items-center justify-center rounded-lg bg-ink text-[13px] font-bold text-on-primary">cv</span>
          <div>
            <strong className="block text-base leading-[1.3]">cbt_vibe</strong>
            <span className="block text-xs leading-[1.33] text-ink-muted">local study</span>
          </div>
        </div>

        <nav className="flex flex-col gap-1 max-[1100px]:grid max-[1100px]:grid-cols-3 max-[680px]:grid-cols-2" aria-label="주요 메뉴">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.key}
                className={
                  view === item.key
                    ? "relative flex min-h-[42px] w-full items-center gap-2.5 rounded-lg border-0 bg-canvas-soft px-3 py-2.5 text-left font-semibold text-ink before:absolute before:left-1 before:top-1/2 before:h-[18px] before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-primary"
                    : "relative flex min-h-[42px] w-full items-center gap-2.5 rounded-lg border-0 bg-transparent px-3 py-2.5 text-left text-ink-secondary hover:bg-canvas-soft"
                }
                onClick={() => setView(item.key)}
                type="button"
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto rounded-lg border border-hairline p-2.5 max-[1100px]:hidden">
          <div className="grid min-h-7 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 text-[13px] text-ink-muted">
            <CircleDot size={14} />
            <span>OpenAI</span>
            <b className={state.env.openaiConfigured ? "text-[11px] text-accent-green" : "text-[11px] text-ink-faint"}>
              {state.env.openaiConfigured ? "ON" : "OFF"}
            </b>
          </div>
          <div className="grid min-h-7 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 text-[13px] text-ink-muted">
            <CircleDot size={14} />
            <span>Gemini</span>
            <b className={state.env.geminiConfigured ? "text-[11px] text-accent-green" : "text-[11px] text-ink-faint"}>
              {state.env.geminiConfigured ? "ON" : "OFF"}
            </b>
          </div>
        </div>
      </aside>

      <section className="flex min-w-0 flex-col gap-[18px] p-[18px] max-[680px]:p-3">
        <header className="flex items-center justify-between gap-4 max-[680px]:flex-col max-[680px]:items-stretch">
          <div>
            <p className="m-0 text-xs font-semibold leading-[1.33] text-primary">AI CBT MVP</p>
            <h1 className="m-0 text-[26px] leading-[1.23]">{navItems.find((item) => item.key === view)?.label}</h1>
          </div>
          <div className="flex items-center gap-2 max-[680px]:w-full">
            <label className="flex min-h-10 items-center gap-2 rounded-full border border-hairline bg-surface px-3 focus-within:border-primary focus-within:shadow-[rgba(0,117,222,0.14)_0_0_0_3px] max-[680px]:flex-1">
              <Search size={16} />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="min-w-[210px] border-0 bg-transparent outline-none max-[680px]:min-w-0 max-[680px]:w-full"
                placeholder="검색"
              />
            </label>
            <button className="inline-flex size-10 items-center justify-center rounded-full border border-hairline bg-surface" onClick={() => void loadState()} title="새로고침" type="button">
              <RefreshCw size={17} />
            </button>
            <button className="inline-flex size-10 items-center justify-center rounded-full border border-hairline bg-surface" title="설정" type="button">
              <Settings size={17} />
            </button>
          </div>
        </header>

        {statusMessage ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-surface px-3 py-2.5 text-sm text-ink-secondary shadow-soft" role="status">
            {statusMessage}
            <button className="flex items-center border-0 bg-transparent" onClick={() => setStatusMessage("")} type="button" title="닫기">
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
    <div className="grid gap-4 grid-cols-[1.2fr_0.8fr] max-[1100px]:grid-cols-1">
      <section className="flex items-center justify-between rounded-lg border border-hairline bg-secondary p-5 text-on-primary max-[680px]:flex-col max-[680px]:items-stretch">
        <div>
          <p className="m-0 text-xs font-semibold leading-[1.33] text-on-primary">오늘의 학습</p>
          <h2 className="m-0 mt-1.5 max-w-[520px] text-[26px] leading-[1.23]">기록이 쌓일수록 오답 흐름이 선명해집니다.</h2>
        </div>
        <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-transparent bg-primary px-4 font-medium text-on-primary active:bg-primary-active" onClick={onStart} type="button">
          <BookOpen size={18} />
          이어서 풀기
        </button>
      </section>

      <section className="grid grid-cols-2 gap-3 max-[680px]:grid-cols-1">
        <Metric label="문제" value={`${state.stats.totalQuestions}`} />
        <Metric label="풀이" value={`${state.stats.totalAttempts}`} />
        <Metric label="정답률" value={`${state.stats.accuracy}%`} />
        <Metric label="오답" value={`${state.stats.openWrongNotes}`} />
      </section>

      <section className="min-w-0 rounded-lg border border-hairline bg-surface p-5">
        <PanelHeader title="최근 풀이" icon={History} />
        <div className="flex flex-col">
          {state.recentAttempts.length === 0 ? (
            <EmptyLine label="풀이 기록 없음" />
          ) : (
            state.recentAttempts.map((attempt) => (
              <div className="grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2.5 border-t border-hairline py-2.5 max-[680px]:flex max-[680px]:flex-col max-[680px]:items-stretch max-[680px]:gap-1.5" key={attempt.id}>
                <span className={attempt.isCorrect ? "inline-block size-2 rounded-full bg-accent-green" : "inline-block size-2 rounded-full bg-danger"} />
                <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-sm">{attempt.questionStem}</strong>
                <span className="text-[13px] text-ink-muted">{attempt.category}</span>
                <b className="text-[13px] text-ink-muted">{attempt.isCorrect ? "정답" : "오답"}</b>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="min-w-0 rounded-lg border border-hairline bg-surface p-5">
        <PanelHeader title="카테고리" icon={BadgeCheck} />
        <div className="flex flex-col">
          {state.stats.categories.length === 0 ? (
            <EmptyLine label="카테고리 기록 없음" />
          ) : (
            state.stats.categories.map((category) => (
              <div className="grid min-h-12 grid-cols-[minmax(90px,0.45fr)_1fr_auto] items-center gap-3 border-t border-hairline" key={category.category}>
                <span className="text-sm">{category.category}</span>
                <div className="h-2 overflow-hidden rounded-full bg-canvas-soft">
                  <i className="block h-full bg-primary" style={{ width: `${category.accuracy}%` }} />
                </div>
                <b className="text-sm">{category.accuracy}%</b>
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
    <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-4 max-[1100px]:grid-cols-1">
      <section className="min-h-[calc(100vh-120px)] min-w-0 rounded-lg border border-hairline bg-surface p-5 max-[1100px]:min-h-0">
        {activeQuestion ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              <Badge>{getQuestionTypeLabel(activeQuestion.type)}</Badge>
              <Badge>{activeQuestion.category}</Badge>
              <Badge>{activeQuestion.difficulty}</Badge>
            </div>
            <h2 className="m-[28px_0] text-2xl leading-[1.45]">{activeQuestion.stem}</h2>

            {activeQuestion.type === "short_answer" ? (
              <label className="flex flex-col gap-2">
                <span className="text-[13px] text-ink-muted">답안</span>
                <input
                  className="min-h-[38px] w-full rounded border border-hairline bg-surface px-2 py-1.5 text-ink outline-none focus:border-primary focus:shadow-[rgba(0,117,222,0.14)_0_0_0_3px]"
                  value={selectedAnswer}
                  onChange={(event) => setSelectedAnswer(event.target.value)}
                  placeholder="정답 입력"
                />
              </label>
            ) : (
              <div className="grid gap-2.5">
                {activeQuestion.choices.map((choice, index) => (
                  <button
                    className={
                      selectedAnswer === choice
                        ? "grid min-h-14 w-full grid-cols-[34px_minmax(0,1fr)] items-center gap-3 rounded-lg border border-primary bg-surface px-3 py-2 text-left text-ink shadow-[rgba(0,117,222,0.16)_0_0_0_3px]"
                        : "grid min-h-14 w-full grid-cols-[34px_minmax(0,1fr)] items-center gap-3 rounded-lg border border-hairline bg-surface px-3 py-2 text-left text-ink hover:border-primary"
                    }
                    key={choice}
                    onClick={() => setSelectedAnswer(choice)}
                    type="button"
                  >
                    <span className="flex size-8 items-center justify-center rounded-full bg-canvas-soft font-semibold">{index + 1}</span>
                    <b className="font-medium leading-[1.45]">{choice}</b>
                  </button>
                ))}
              </div>
            )}

            {answered ? (
              <div className={answered.isCorrect ? "mt-[18px] rounded-lg border border-[rgba(26,174,57,0.24)] bg-[#effaf1] p-3.5" : "mt-[18px] rounded-lg border border-[rgba(217,45,32,0.22)] bg-danger-soft p-3.5"}>
                <strong className="block">{answered.isCorrect ? "정답" : "오답"}</strong>
                <span className="block text-[15px] leading-[1.5]">정답: {answered.answer}</span>
                {activeQuestion.explanation ? <p className="text-[15px] leading-[1.5]">{activeQuestion.explanation}</p> : null}
              </div>
            ) : null}

            <div className="mt-4 flex items-center gap-2">
              <button
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-transparent bg-primary px-4 font-medium text-on-primary active:bg-primary-active"
                disabled={!selectedAnswer || busy}
                onClick={onSubmit}
                type="button"
              >
                {busy ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                채점
              </button>
              <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-hairline bg-surface px-3.5 text-ink" onClick={() => onGenerateSimilar(activeQuestion)} type="button">
                <Sparkles size={17} />
                유사 문제
              </button>
            </div>
          </>
        ) : (
          <EmptyLine label="문제 없음" />
        )}
      </section>

      <aside className="max-h-[calc(100vh-120px)] min-w-0 overflow-hidden rounded-lg border border-hairline bg-surface p-5 max-[1100px]:max-h-none">
        <PanelHeader title="문제 목록" icon={LibraryBig} />
        <div className="flex max-h-[calc(100vh-180px)] flex-col gap-1.5 overflow-auto">
          {filteredQuestions.map((question) => (
            <button
              className={
                question.id === activeQuestion?.id
                  ? "block w-full rounded-lg border border-hairline bg-canvas-soft p-2.5 text-left text-ink"
                  : "block w-full rounded-lg border border-transparent bg-transparent p-2.5 text-left text-ink hover:border-hairline hover:bg-canvas-soft"
              }
              key={question.id}
              onClick={() => onChoose(question.id)}
              type="button"
            >
              <span className="mb-1 block text-xs text-ink-muted">{question.category}</span>
              <strong className="line-clamp-2 block text-sm font-medium leading-[1.38]">{question.stem}</strong>
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
    <section className="min-h-[calc(100vh-120px)] min-w-0 rounded-lg border border-hairline bg-surface p-5 max-[1100px]:min-h-0">
      <PanelHeader title="오답노트" icon={NotebookTabs} />
      <div className="flex flex-col">
        {wrongNotes.length === 0 ? (
          <EmptyLine label="오답 기록 없음" />
        ) : (
          wrongNotes.map((note) => {
            const question = questions.find((item) => item.id === note.questionId);

            if (!question) {
              return null;
            }

            return (
              <article className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-t border-hairline py-4 max-[680px]:flex max-[680px]:flex-col max-[680px]:items-stretch" key={note.questionId}>
                <div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge>{question.category}</Badge>
                    <Badge>{note.resolvedAt ? "해결" : "복습"}</Badge>
                    <Badge>{`${note.wrongCount}회`}</Badge>
                  </div>
                  <h3 className="my-2.5 text-[17px] leading-[1.45]">{question.stem}</h3>
                  <textarea
                    className="min-h-[74px] w-full resize-y rounded border border-hairline p-2"
                    value={note.memo}
                    onChange={(event) => onUpdate(note.questionId, { memo: event.target.value })}
                    placeholder="오답 메모"
                  />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-hairline bg-surface px-3.5 text-ink" onClick={() => onChoose(question.id)} type="button">
                    <BookOpen size={16} />
                    풀기
                  </button>
                  <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-hairline bg-surface px-3.5 text-ink" onClick={() => onGenerateSimilar(question)} type="button">
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
    <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-4 max-[1100px]:grid-cols-1">
      <section className="min-w-0 rounded-lg border border-hairline bg-surface p-5">
        <PanelHeader title="문제 등록" icon={Plus} />
        <div className="mb-3 grid grid-cols-2 gap-3 max-[680px]:grid-cols-1">
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
        <label className="mb-3 flex flex-col gap-1.5">
          <span className="text-[13px] text-ink-muted">문제 지문</span>
          <textarea
            className="min-h-[104px] w-full resize-y rounded border border-hairline bg-surface px-2 py-1.5 text-ink outline-none focus:border-primary focus:shadow-[rgba(0,117,222,0.14)_0_0_0_3px]"
            value={form.stem}
            onChange={(event) => setForm({ ...form, stem: event.target.value })}
          />
        </label>

        {choiceCount > 0 ? (
          <div className="mb-3 grid grid-cols-2 gap-3 max-[680px]:grid-cols-1">
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

        <div className="mb-3 grid grid-cols-2 gap-3 max-[680px]:grid-cols-1">
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

        <label className="mb-3 flex flex-col gap-1.5">
          <span className="text-[13px] text-ink-muted">해설</span>
          <textarea
            className="min-h-[104px] w-full resize-y rounded border border-hairline bg-surface px-2 py-1.5 text-ink outline-none focus:border-primary focus:shadow-[rgba(0,117,222,0.14)_0_0_0_3px]"
            value={form.explanation}
            onChange={(event) => setForm({ ...form, explanation: event.target.value })}
          />
        </label>

        <div className="mt-4 flex items-center gap-2">
          <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-transparent bg-primary px-4 font-medium text-on-primary active:bg-primary-active" disabled={busy} onClick={onSave} type="button">
            {busy ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            저장
          </button>
        </div>
      </section>

      <section className="min-w-0 rounded-lg border border-hairline bg-surface p-5">
        <PanelHeader title="문제 은행" icon={LibraryBig} />
        <div className="flex max-h-[calc(100vh-220px)] flex-col gap-1.5 overflow-auto">
          {filteredQuestions.map((question) => (
            <button className="block w-full rounded-lg border border-transparent bg-transparent p-2.5 text-left text-ink hover:border-hairline hover:bg-canvas-soft" key={question.id} onClick={() => onChoose(question.id)} type="button">
              <span className="mb-1 block text-xs text-ink-muted">{`${getQuestionTypeLabel(question.type)} · ${question.category}`}</span>
              <strong className="line-clamp-2 block text-sm font-medium leading-[1.38]">{question.stem}</strong>
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
    <section className="min-h-[calc(100vh-120px)] min-w-0 rounded-lg border border-hairline bg-surface p-5 max-[1100px]:min-h-0">
      <PanelHeader title="엑셀 가져오기" icon={FileSpreadsheet} />
      <label className="relative flex min-h-[118px] items-center justify-center gap-2.5 rounded-xl border border-dashed border-ink-faint bg-canvas-soft text-ink-secondary">
        <FileSpreadsheet size={22} />
        <span>xlsx 파일 선택</span>
        <input
          className="absolute inset-0 cursor-pointer opacity-0"
          accept=".xlsx,.xls"
          onChange={(event) => onFile(event.target.files?.[0] || null)}
          type="file"
        />
      </label>

      <div className="mt-4 flex items-center justify-between gap-2">
        <span>{`검증 통과 ${validCount} / ${preview.length}`}</span>
        <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-transparent bg-primary px-4 font-medium text-on-primary active:bg-primary-active" disabled={validCount === 0 || busy} onClick={onSave} type="button">
          {busy ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          저장
        </button>
      </div>

      <div className="flex flex-col">
        {preview.length === 0 ? (
          <EmptyLine label="가져오기 대기" />
        ) : (
          preview.map((item) => (
            <div className={item.errors.length ? "grid min-h-[52px] grid-cols-[46px_92px_minmax(0,1fr)_minmax(120px,0.4fr)] items-center gap-3 border-t border-hairline max-[680px]:flex max-[680px]:flex-col max-[680px]:items-stretch max-[680px]:gap-1.5" : "grid min-h-[52px] grid-cols-[46px_92px_minmax(0,1fr)_minmax(120px,0.4fr)] items-center gap-3 border-t border-hairline max-[680px]:flex max-[680px]:flex-col max-[680px]:items-stretch max-[680px]:gap-1.5"} key={item.rowNumber}>
              <b>{item.rowNumber}</b>
              <span className="text-[13px] text-ink-muted">{getQuestionTypeLabel(item.question.type)}</span>
              <strong className="overflow-hidden text-ellipsis whitespace-nowrap">{item.question.stem || "빈 지문"}</strong>
              <em className={item.errors.length ? "text-[13px] not-italic text-danger" : "text-[13px] not-italic text-ink-muted"}>{item.errors.length ? item.errors.join(" ") : "OK"}</em>
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
    <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-4 max-[1100px]:grid-cols-1">
      <section className="min-w-0 rounded-lg border border-hairline bg-surface p-5">
        <PanelHeader title="AI 생성" icon={Brain} />
        <div className="mb-3 grid grid-cols-2 gap-3 max-[680px]:grid-cols-1">
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
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-ink-muted">개수</span>
            <input
              className="min-h-[38px] w-full rounded border border-hairline bg-surface px-2 py-1.5 text-ink outline-none focus:border-primary focus:shadow-[rgba(0,117,222,0.14)_0_0_0_3px]"
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

        <label className="mb-3 flex flex-col gap-1.5">
          <span className="text-[13px] text-ink-muted">요청</span>
          <textarea
            className="min-h-[104px] w-full resize-y rounded border border-hairline bg-surface px-2 py-1.5 text-ink outline-none focus:border-primary focus:shadow-[rgba(0,117,222,0.14)_0_0_0_3px]"
            value={form.instruction}
            onChange={(event) => setForm({ ...form, instruction: event.target.value })}
          />
        </label>

        <div className="mt-4 flex items-center gap-2">
          <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-transparent bg-primary px-4 font-medium text-on-primary active:bg-primary-active" disabled={busy} onClick={onGenerate} type="button">
            {busy ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
            생성
          </button>
          <button
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-hairline bg-surface px-3.5 text-ink"
            disabled={generatedQuestions.length === 0 || busy}
            onClick={onSave}
            type="button"
          >
            <Save size={17} />
            저장
          </button>
        </div>
      </section>

      <section className="min-w-0 rounded-lg border border-hairline bg-surface p-5">
        <PanelHeader title="검수 목록" icon={ClipboardList} />
        <div className="flex max-h-[calc(100vh-180px)] flex-col gap-0 overflow-auto">
          {generatedQuestions.length === 0 ? (
            <EmptyLine label="생성 결과 없음" />
          ) : (
            generatedQuestions.map((question, index) => (
              <article className="block border-t border-hairline py-4" key={`${question.stem}-${index}`}>
                <div className="flex flex-wrap gap-1.5">
                  <Badge>{getQuestionTypeLabel(question.type)}</Badge>
                  <Badge>{question.category}</Badge>
                  <Badge>{question.difficulty}</Badge>
                </div>
                <h3 className="my-2.5 text-[17px] leading-[1.45]">{question.stem}</h3>
                {question.choices.length ? (
                  <ol className="my-2.5 pl-[22px]">
                    {question.choices.map((choice) => (
                      <li key={choice}>{choice}</li>
                    ))}
                  </ol>
                ) : null}
                <p className="text-sm text-ink-secondary">
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
    <div className="min-h-[94px] rounded-lg border border-hairline bg-surface p-[18px]">
      <span className="block text-[13px] text-ink-muted">{label}</span>
      <strong className="mt-2.5 block text-3xl leading-[1.2]">{value}</strong>
    </div>
  );
}

function PanelHeader({ title, icon: Icon }: { title: string; icon: typeof ClipboardList }) {
  return (
    <div className="mb-3.5 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon size={18} />
        <h2 className="m-0 text-lg leading-[1.33]">{title}</h2>
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex rounded-full bg-canvas-soft px-2 py-1 text-xs font-semibold leading-[1.33] text-ink-secondary">{children}</span>;
}

function EmptyLine({ label }: { label: string }) {
  return <div className="flex min-h-[52px] items-center border-t border-hairline text-sm text-ink-muted">{label}</div>;
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
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] text-ink-muted">{label}</span>
      <input className="min-h-[38px] w-full rounded border border-hairline bg-surface px-2 py-1.5 text-ink outline-none focus:border-primary focus:shadow-[rgba(0,117,222,0.14)_0_0_0_3px]" value={value} onChange={(event) => onChange(event.target.value)} />
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
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] text-ink-muted">{label}</span>
      <select className="min-h-[38px] w-full rounded border border-hairline bg-surface px-2 py-1.5 text-ink outline-none focus:border-primary focus:shadow-[rgba(0,117,222,0.14)_0_0_0_3px]" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}
