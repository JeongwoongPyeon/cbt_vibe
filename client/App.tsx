import {
  BadgeCheck,
  BookOpen,
  Brain,
  Check,
  CircleDot,
  ClipboardList,
  FileSpreadsheet,
  History,
  ImagePlus,
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
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { PracticeWorkspace } from "./components/PracticeWorkspace";
import { SubjectPicker, SubjectsContext } from "./components/SubjectPicker";
import { SubjectManager } from "./components/SubjectManager";
import { ApiSettings, ProviderPicker } from "./components/ProviderPicker";
import { AI_PROVIDERS, providerConfigured } from "@/lib/providers";
import { QuestionFilterBar, QuestionProgress } from "./components/QuestionOverview";
import { attemptHistory, emptyFilters, filterQuestions, type QuestionFilters } from "@/lib/study";
import { parseExamSession } from "@/lib/exam";
import { getDefaultCriteria, getCurriculum } from "@/lib/curriculum";
import { EXAM_TYPES } from "@/lib/types";
import type { AiProvider, AppState, Attempt, ExamType, Question, QuestionDraft, QuestionType, WrongNote } from "@/lib/types";
import {
  navItem,
  providerStatus,
  tabButton,
  ui,
  validationStatus,
} from "@/lib/ui-classes";
import {
  getChoiceCount,
  getQuestionTypeLabel,
  normalizeQuestionType,
  validateQuestionDraft,
} from "@/lib/validation";

const StudyAnalytics = lazy(() => import('./components/StudyAnalytics'));

type ViewKey = "dashboard" | "practice" | "wrong" | "bank" | "import" | "ai" | "settings";

type ManualForm = {
  examType: ExamType;
  type: QuestionType;
  category: string;
  part: string;
  unit: string;
  topic: string;
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
  provider: AiProvider;
  examType: ExamType;
  type: QuestionType;
  category: string;
  part: string;
  unit: string;
  topic: string;
  difficulty: string;
  count: number;
  instruction: string;
  baseQuestionId: string;
};

type AiMode = "generate" | "photo";

type CriteriaForm = {
  examType: ExamType;
  part: string;
  unit: string;
  topic: string;
};

const emptyManualForm: ManualForm = {
  examType: "ncs",
  type: "multiple_choice_4",
  category: "정보처리 기초",
  ...getDefaultCriteria("ncs"),
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
  { key: "settings", label: "설정", icon: Settings },
];

export default function Home() {
  const [resumeExam] = useState(() => {
    try {
      return EXAM_TYPES.map(({ id }) => parseExamSession(localStorage.getItem(`cbt.exam.v1.${id}`), id))
        .filter((session) => session && !session.result).sort((a, b) => b!.startedAt - a!.startedAt)[0];
    } catch { return null; }
  });
  const [state, setState] = useState<AppState | null>(null);
  const [examType, setExamType] = useState<ExamType>(resumeExam?.examType || "ncs");
  const [view, setView] = useState<ViewKey>(resumeExam ? "practice" : "dashboard");
  const [activeQuestionId, setActiveQuestionId] = useState("");
  const [filters, setFilters] = useState<QuestionFilters>(emptyFilters);
  const [examLocked, setExamLocked] = useState(!!resumeExam);
  const loadSequence = useRef(0);
  const [manualForm, setManualForm] = useState<ManualForm>(emptyManualForm);
  const [importPreview, setImportPreview] = useState<ImportPreview[]>([]);
  const [generatedQuestions, setGeneratedQuestions] = useState<QuestionDraft[]>([]);
  const [aiMode, setAiMode] = useState<AiMode>("generate");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiForm, setAiForm] = useState<AiForm>({
    provider: "openai",
    examType: "ncs",
    type: "multiple_choice_4",
    category: "",
    ...getDefaultCriteria("ncs"),
    difficulty: "보통",
    count: 3,
    instruction: "",
    baseQuestionId: "",
  });

  useEffect(() => {
    void loadState(examType);
  }, [examType]);

  const filteredQuestions = useMemo(() => state ? filterQuestions(state.questions, state.attempts, filters, searchTerm) : [], [state, filters, searchTerm]);

  async function loadState(nextExamType: ExamType = examType) {
    const sequence = ++loadSequence.current;
    const response = await fetch(`/api/state?examType=${encodeURIComponent(nextExamType)}`, { cache: "no-store" });
    const nextState = (await response.json()) as AppState;
    if (sequence !== loadSequence.current) return;
    if (!nextState.subjects.some(subject => subject.active && subject.id === nextExamType)) {
      try {localStorage.removeItem(`cbt.exam.v1.${nextExamType}`);} catch { /* Storage may be unavailable. */ }
      setExamLocked(false);
      setView("bank");
    }
    setState(nextState);
    setExamType(nextState.examType);
    setActiveQuestionId("");
    setFilters(emptyFilters);
    setManualForm((current) => ({ ...current, examType: nextState.examType }));
    setAiForm((current) => ({
      ...current,
      examType: nextState.examType,
      provider: nextState.env.defaultProvider,
      baseQuestionId: "",
      ...getDefaultCriteria(nextState.examType),
    }));
  }

  function chooseQuestion(questionId: string) {
    setActiveQuestionId(questionId);
  }

  function applySubjectState(next: AppState, deleted?: ExamType) {
    ++loadSequence.current;
    if (deleted) {
      try {localStorage.removeItem(`cbt.exam.v1.${deleted}`);} catch { /* Storage may be unavailable. */ }
    }
    setState(next); setExamType(next.examType); setExamLocked(false);
    setActiveQuestionId(""); setFilters(emptyFilters); setSearchTerm("");
    setImportPreview([]); setGeneratedQuestions([]);
    setManualForm({...emptyManualForm, examType:next.examType, ...getDefaultCriteria(next.examType)});
    setAiForm(current => ({...current,examType:next.examType,baseQuestionId:"",...getDefaultCriteria(next.examType)}));
    setStatusMessage(deleted ? "과목과 학습 데이터를 삭제했습니다." : "빈 과목을 추가했습니다.");
  }

  function changeFilters(next: QuestionFilters) {
    setFilters(next);
    setActiveQuestionId("");
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
    setManualForm({...emptyManualForm, examType, ...getDefaultCriteria(examType)});
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
      setExamType(payload.state.examType);

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
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    const preview = rows.map((row, index) => {
      const validation = validateQuestionDraft({
        type: normalizeQuestionType(row.type),
        examType: row.exam_type || row.examType || examType,
        category: row.category,
        part: row.part,
        unit: row.unit,
        topic: row.topic,
        stem: row.question || row.stem,
        choices: [row.choice_1, row.choice_2, row.choice_3, row.choice_4, row.choice_5]
          .map((value) => String(value || "").trim())
          .filter(Boolean),
        answer: row.answer,
        acceptableAnswers: row.acceptable_answers || row.acceptableAnswers,
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

  async function importPhotoQuestions() {
    if (photoFiles.length === 0) {
      setStatusMessage("문제집 사진을 한 장 이상 선택해 주세요.");
      return;
    }

    setBusy(true);
    setGeneratedQuestions([]);
    setStatusMessage("");

    try {
      const formData = new FormData();
      photoFiles.forEach((file) => formData.append("images", file, file.name));
      formData.set("provider", aiForm.provider);
      formData.set("examType", aiForm.examType);
      formData.set("category", aiForm.category);
      formData.set("part", aiForm.part);
      formData.set("unit", aiForm.unit);
      formData.set("topic", aiForm.topic);
      formData.set("difficulty", aiForm.difficulty);
      formData.set("maxQuestions", String(Math.min(10, Math.max(1, aiForm.count))));
      formData.set("instruction", aiForm.instruction);

      const response = await fetch("/api/ai/import-images", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "사진 문제 변환에 실패했습니다.");
      }

      setGeneratedQuestions(payload.questions || []);
      setStatusMessage(
        payload.errors?.length
          ? `검토가 필요한 항목이 있습니다: ${payload.errors.join(" ")}`
          : `${payload.questions?.length || 0}개 문제를 추출했습니다.`,
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "사진 문제 변환에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function saveGeneratedQuestions() {
    const validations = generatedQuestions.map((question) => validateQuestionDraft(question));
    const errors = validations.flatMap((validation) => validation.errors);

    if (errors.length > 0) {
      setStatusMessage(`저장 전 확인이 필요합니다: ${errors.join(" ")}`);
      return;
    }

    await saveQuestions(
      validations.map((validation) => validation.question),
      `${validations.length}개 문제를 저장했습니다.`,
    );
  }

  function updateGeneratedQuestion(index: number, updates: Partial<QuestionDraft>) {
    setGeneratedQuestions((current) =>
      current.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...updates } : question,
      ),
    );
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
    const defaults = getDefaultCriteria(question.examType);
    setAiForm((current) => ({
      ...current,
      type: question.type,
      examType: question.examType,
      category: question.category,
      part: question.part || defaults.part,
      unit: question.unit || defaults.unit,
      topic: question.topic || defaults.topic,
      difficulty: question.difficulty,
      baseQuestionId: question.id,
      instruction: "기준 문제와 같은 개념을 다루되 지문과 보기를 새롭게 구성",
    }));
    setGeneratedQuestions([]);
    setView("ai");
  }

  function updateAiForm(nextForm: AiForm) {
    if (nextForm.examType !== aiForm.examType) {
      setAiForm({ ...nextForm, ...getDefaultCriteria(nextForm.examType) });
      return;
    }

    setAiForm(nextForm);
  }

  if (!state) {
    return (
      <main className={ui.layout.loading}>
        <Loader2 className={ui.icon.spin} size={24} />
        <span>cbt_vibe</span>
      </main>
    );
  }

  const hasSubjects = state.subjects.some(subject => subject.active);
  return (
    <SubjectsContext.Provider value={state.subjects}>
    <main className={ui.layout.app}>
      <aside className={ui.layout.sidebar}>
        <div className={ui.brand.row}>
          <span className={ui.brand.mark}>cv</span>
          <div>
            <strong className={ui.brand.name}>cbt_vibe</strong>
            <span className={ui.brand.subtitle}>local study</span>
          </div>
        </div>

        <nav className={ui.nav.list} aria-label="주요 메뉴">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.key}
                className={navItem(view === item.key)}
                disabled={busy || (examLocked && item.key !== "practice") || (!hasSubjects && item.key !== "bank" && item.key !== "settings")}
                onClick={() => setView(item.key)}
                type="button"
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className={ui.provider.card}>
          {AI_PROVIDERS.map(provider => <div className={ui.provider.row} key={provider.id}>
            <CircleDot size={14} />
            <span>{provider.label}</span>
            <b className={providerStatus(providerConfigured(state.env,provider.id))}>
              {providerConfigured(state.env,provider.id) ? "ON" : "OFF"}
            </b>
          </div>)}
        </div>
      </aside>

      <section className={ui.layout.content}>
        <header className={ui.layout.header}>
          <div>
            <p className={ui.section.eyebrow}>AI CBT MVP</p>
            <h1 className={ui.section.pageTitle}>{navItems.find((item) => item.key === view)?.label}</h1>
          </div>
          <div className={ui.layout.toolbar}>
            <SubjectPicker compact value={examType} disabled={examLocked || busy}
                onChange={(nextExamType) => {
                  setExamType(nextExamType);
                  setImportPreview([]); setGeneratedQuestions([]); setSearchTerm("");
                  setManualForm((current) => ({
                    ...current,
                    examType: nextExamType,
                    ...getDefaultCriteria(nextExamType),
                  }));
                  setAiForm((current) => ({
                    ...current,
                    baseQuestionId: "",
                    examType: nextExamType,
                    ...getDefaultCriteria(nextExamType),
                  }));
                }} />
            <label className={ui.field.searchShell}>
              <Search size={16} />
              <input
                value={searchTerm}
                disabled={examLocked}
                onChange={(event) => { setSearchTerm(event.target.value); setActiveQuestionId(""); }}
                className={ui.field.searchInput}
                placeholder="검색"
              />
            </label>
            <button className={ui.button.icon} disabled={examLocked} onClick={() => void loadState()} title="새로고침" type="button">
              <RefreshCw size={17} />
            </button>
            <button className={ui.button.icon} title="설정" type="button" disabled={examLocked || busy} onClick={() => setView("settings")}>
              <Settings size={17} />
            </button>
          </div>
        </header>

        {statusMessage ? (
          <div className={ui.status} role="status">
            {statusMessage}
            <button className={ui.button.close} onClick={() => setStatusMessage("")} type="button" title="닫기">
              <X size={14} />
            </button>
          </div>
        ) : null}

        {(view === "bank" || view === "settings" || !hasSubjects) && <SubjectManager subjects={state.subjects} disabled={busy || examLocked} onChange={applySubjectState} />}
        {view === "settings" && <ApiSettings env={state.env} />}
        {hasSubjects && view === "dashboard" ? (
          <DashboardView state={state} onStart={() => setView("practice")} />
        ) : null}

        {hasSubjects && view === "practice" ? (
          <PracticeWorkspace
            key={state.examType}
            examType={state.examType}
            questions={state.questions}
            attempts={state.attempts}
            activeQuestionId={activeQuestionId}
            filters={filters}
            onFilterChange={changeFilters}
            onClearSearch={() => setSearchTerm("")}
            onLockChange={setExamLocked}
            onStateChange={(next) => setState((current) => current?.examType === next.examType ? next : current)}
            filteredQuestions={filteredQuestions}
            onChoose={chooseQuestion}
            onGenerateSimilar={setSimilarGeneration}
          />
        ) : null}

        {hasSubjects && view === "wrong" ? (
          <WrongNotesView
            questions={state.questions}
            wrongNotes={state.wrongNotes}
            onChoose={(questionId) => {
              changeFilters(emptyFilters);
              setSearchTerm("");
              chooseQuestion(questionId);
              setView("practice");
            }}
            onGenerateSimilar={setSimilarGeneration}
            onUpdate={(questionId, updates) => void updateWrongNote(questionId, updates)}
          />
        ) : null}

        {hasSubjects && view === "bank" ? (
          <QuestionBankView
            busy={busy}
            questions={state.questions}
            attempts={state.attempts}
            filters={filters}
            onFilterChange={changeFilters}
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

        {hasSubjects && view === "import" ? (
          <ImportView
            busy={busy}
            preview={importPreview}
            onFile={(file) => void handleExcelFile(file)}
            onSave={() => void saveImportedQuestions()}
          />
        ) : null}

        {hasSubjects && view === "ai" ? (
          <AiGenerateView
            aiMode={aiMode}
            busy={busy}
            env={state.env}
            form={aiForm}
            generatedQuestions={generatedQuestions}
            photoFiles={photoFiles}
            questions={state.questions}
            onImportPhotos={() => void importPhotoQuestions()}
            onGenerate={() => void generateAiQuestions()}
            onModeChange={(mode) => {
              setAiMode(mode);
              setGeneratedQuestions([]);
              setStatusMessage("");
            }}
            onPhotoFilesChange={setPhotoFiles}
            onSave={() => void saveGeneratedQuestions()}
            onUpdateQuestion={updateGeneratedQuestion}
            setForm={setAiForm}
          />
        ) : null}
      </section>
    </main>
    </SubjectsContext.Provider>
  );
}

function DashboardView({ state, onStart }: { state: AppState; onStart: () => void }) {
  return (
    <div className={ui.layout.dashboardGrid}>
      <section className={ui.panel.darkCallout}>
        <div>
          <p className={ui.section.darkEyebrow}>오늘의 학습</p>
          <h2 className={ui.section.calloutTitle}>기록이 쌓일수록 오답 흐름이 선명해집니다.</h2>
        </div>
        <button className={ui.button.primary} onClick={onStart} type="button">
          <BookOpen size={18} />
          이어서 풀기
        </button>
      </section>

      <section className={ui.layout.metricGrid}>
        <Metric label="문제" value={`${state.stats.totalQuestions}`} />
        <Metric label="풀이" value={`${state.stats.totalAttempts}`} />
        <Metric label="정답률" value={`${state.stats.accuracy}%`} />
        <Metric label="오답" value={`${state.stats.openWrongNotes}`} />
      </section>

      <Suspense fallback={<p role="status">통계 불러오는 중…</p>}><StudyAnalytics state={state} /></Suspense>
      <section className={ui.panel.surface}>
        <PanelHeader title="최근 풀이" icon={History} />
        <div className={ui.layout.stack}>
          {state.recentAttempts.length === 0 ? (
            <EmptyLine label="풀이 기록 없음" />
          ) : (
            state.recentAttempts.map((attempt) => (
              <div className={ui.list.row} key={attempt.id}>
                <span className={attempt.isCorrect ? "inline-block size-2 rounded-full bg-accent-green" : "inline-block size-2 rounded-full bg-danger"} />
                <strong className={ui.text.listQuestion}>{attempt.questionStem}</strong>
                <span className={ui.text.muted13}>{attempt.category}</span>
                <b className={ui.text.muted13}>{attempt.isCorrect ? "정답" : "오답"}</b>
              </div>
            ))
          )}
        </div>
      </section>

      <section className={ui.panel.surface}>
        <PanelHeader title="카테고리" icon={BadgeCheck} />
        <div className={ui.layout.stack}>
          {state.stats.categories.length === 0 ? (
            <EmptyLine label="카테고리 기록 없음" />
          ) : (
            state.stats.categories.map((category) => (
              <div className={ui.list.statRow} key={category.category}>
              <span className={ui.text.sm}>{category.category}</span>
              <div className={ui.progressTrack}>
                <i className={ui.progressBar} style={{ width: `${category.accuracy}%` }} />
                </div>
              <b className={ui.text.sm}>{category.accuracy}%</b>
              </div>
            ))
          )}
        </div>
      </section>
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
    <section className={ui.panel.tall}>
      <PanelHeader title="오답노트" icon={NotebookTabs} />
      <div className={ui.layout.stack}>
        {wrongNotes.length === 0 ? (
          <EmptyLine label="오답 기록 없음" />
        ) : (
          wrongNotes.map((note) => {
            const question = questions.find((item) => item.id === note.questionId);

            if (!question) {
              return null;
            }

            return (
              <article className={ui.list.noteRow} key={note.questionId}>
                <div>
                  <div className={ui.layout.badgeGroup}>
                    <Badge>{question.category}</Badge>
                    <Badge>{note.resolvedAt ? "해결" : "복습"}</Badge>
                    <Badge>{`${note.wrongCount}회`}</Badge>
                  </div>
                  <h3 className={ui.list.resultTitle}>{question.stem}</h3>
                  <textarea
                    className={ui.field.wrongMemo}
                    value={note.memo}
                    onChange={(event) => onUpdate(note.questionId, { memo: event.target.value })}
                    placeholder="오답 메모"
                  />
                </div>
                <div className={ui.layout.actionRow}>
                  <button className={ui.button.secondary} onClick={() => onChoose(question.id)} type="button">
                    <BookOpen size={16} />
                    풀기
                  </button>
                  <button className={ui.button.secondary} onClick={() => onGenerateSimilar(question)} type="button">
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
  questions,
  attempts,
  filters,
  onFilterChange,
  filteredQuestions,
  form,
  onChoose,
  onSave,
  setForm,
}: {
  busy: boolean;
  questions: Question[];
  attempts: Attempt[];
  filters: QuestionFilters;
  onFilterChange: (filters: QuestionFilters) => void;
  filteredQuestions: Question[];
  form: ManualForm;
  onChoose: (questionId: string) => void;
  onSave: () => void;
  setForm: (form: ManualForm) => void;
}) {
  const choiceCount = getChoiceCount(form.type);
  const history = useMemo(() => attemptHistory(attempts), [attempts]);

  return (
    <div className={ui.layout.panelGrid}>
      <section className={ui.panel.surface}>
        <PanelHeader title="문제 등록" icon={Plus} />
        <div className={ui.layout.fieldGrid}>
          <SubjectPicker
            label="시험 종류"
            disabled={busy}
            value={form.examType}
            onChange={(value) => {
              const nextExamType = value as ExamType;
              setForm({ ...form, examType: nextExamType, ...getDefaultCriteria(nextExamType) });
            }}
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
          <CriteriaFields form={form} setForm={setForm} />
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
        <label className={ui.field.groupWithMargin}>
          <span className={ui.field.label}>문제 지문</span>
          <textarea
            className={ui.field.textarea}
            value={form.stem}
            onChange={(event) => setForm({ ...form, stem: event.target.value })}
          />
        </label>

        {choiceCount > 0 ? (
          <div className={ui.layout.fieldGrid}>
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

        <div className={ui.layout.fieldGrid}>
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

        <label className={ui.field.groupWithMargin}>
          <span className={ui.field.label}>해설</span>
          <textarea
            className={ui.field.textarea}
            value={form.explanation}
            onChange={(event) => setForm({ ...form, explanation: event.target.value })}
          />
        </label>

        <div className={ui.layout.actionRow}>
          <button className={ui.button.primary} disabled={busy} onClick={onSave} type="button">
            {busy ? <Loader2 className={ui.icon.spin} size={18} /> : <Save size={18} />}
            저장
          </button>
        </div>
      </section>

      <section className={ui.panel.surface}>
        <PanelHeader title="문제 은행" icon={LibraryBig} />
        <QuestionFilterBar questions={questions} filters={filters} onChange={onFilterChange} />
        <p className={ui.text.muted13}>{filteredQuestions.length}문항 · 최근 5회 최신순</p>
        <div className={ui.list.resultPanel}>
          {filteredQuestions.map((question) => (
            <button className={ui.button.listItem} key={question.id} onClick={() => onChoose(question.id)} type="button">
              <span className={ui.list.questionMeta}>{[getQuestionTypeLabel(question.type), question.part, question.unit, question.category].filter(Boolean).join(" · ")}</span>
              <strong className={ui.list.questionTitle}>{question.stem}</strong>
              <QuestionProgress attempts={history.get(question.id)} />
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
    <section className={ui.panel.tall}>
      <PanelHeader title="엑셀 가져오기" icon={FileSpreadsheet} />
      <label className={ui.upload}>
        <FileSpreadsheet size={22} />
        <span>xlsx 파일 선택</span>
        <input
          className={ui.uploadInput}
          accept=".xlsx,.xls"
          onChange={(event) => onFile(event.target.files?.[0] || null)}
          type="file"
        />
      </label>

      <div className={ui.layout.actionSummary}>
        <span>{`검증 통과 ${validCount} / ${preview.length}`}</span>
        <button className={ui.button.primary} disabled={validCount === 0 || busy} onClick={onSave} type="button">
          {busy ? <Loader2 className={ui.icon.spin} size={18} /> : <Save size={18} />}
          저장
        </button>
      </div>

      <div className={ui.layout.stack}>
        {preview.length === 0 ? (
          <EmptyLine label="가져오기 대기" />
        ) : (
          preview.map((item) => (
            <div className={ui.list.previewRow} key={item.rowNumber}>
              <b>{item.rowNumber}</b>
              <span className={ui.text.muted13}>{getQuestionTypeLabel(item.question.type)}</span>
              <strong className={ui.text.nowrap}>{item.question.stem || "빈 지문"}</strong>
              <em className={validationStatus(item.errors.length > 0)}>{item.errors.length ? item.errors.join(" ") : "OK"}</em>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

type AiGenerateViewProps = {
  aiMode: AiMode;
  busy: boolean;
  env: AppState["env"];
  form: AiForm;
  generatedQuestions: QuestionDraft[];
  photoFiles: File[];
  questions: Question[];
  onImportPhotos: () => void;
  onGenerate: () => void;
  onModeChange: (mode: AiMode) => void;
  onPhotoFilesChange: (files: File[]) => void;
  onSave: () => void;
  onUpdateQuestion: (index: number, updates: Partial<QuestionDraft>) => void;
  setForm: (form: AiForm) => void;
};

function AiGenerateView(props: AiGenerateViewProps) {
  const isPhotoMode = props.aiMode === "photo";

  return (
      <div className={ui.layout.aiStack}>
      <div className={ui.layout.tabBar} role="tablist">
        <button
          aria-selected={!isPhotoMode}
          className={tabButton(!isPhotoMode)}
          onClick={() => props.onModeChange("generate")}
          role="tab"
          type="button"
        >
          <Brain size={16} />
          일반 생성
        </button>
        <button
          aria-selected={isPhotoMode}
          className={tabButton(isPhotoMode)}
          onClick={() => props.onModeChange("photo")}
          role="tab"
          type="button"
        >
          <ImagePlus size={16} />
          사진 인식
        </button>
      </div>

      {isPhotoMode ? (
        <PhotoImportView {...props} />
      ) : (
        <LegacyAiGenerateView
          busy={props.busy}
          env={props.env}
          form={props.form}
          generatedQuestions={props.generatedQuestions}
          questions={props.questions}
          onGenerate={props.onGenerate}
          onSave={props.onSave}
          setForm={props.setForm}
        />
      )}
    </div>
  );
}

function CriteriaFields<T extends CriteriaForm>({
  form,
  setForm,
}: {
  form: T;
  setForm: (form: T) => void;
}) {
  const parts = getCurriculum(form.examType);

  return (
    <div className={ui.layout.criteriaGrid}>
      <SelectField
        label="대단원 · 기본 목차"
        value={form.part}
        onChange={(value) => setForm({ ...form, part: value, unit: "", topic: "" })}
        options={parts.map((item): [string, string] => [item.label, item.label])}
      />
      <TextField
        label="단원 · 직접 입력"
        value={form.unit}
        onChange={(value) => setForm({ ...form, unit: value })}
      />
      <TextField
        label="세부 기준 · 직접 입력"
        value={form.topic}
        onChange={(value) => setForm({ ...form, topic: value })}
      />
    </div>
  );
}

function PhotoImportView({
  busy,
  env,
  form,
  generatedQuestions,
  photoFiles,
  onImportPhotos,
  onPhotoFilesChange,
  onSave,
  onUpdateQuestion,
  setForm,
}: AiGenerateViewProps) {
  return (
    <div className={ui.layout.panelGrid}>
      <section className={ui.panel.surface}>
        <PanelHeader title="문제집 사진 인식" icon={ImagePlus} />
        <div className={ui.layout.fieldGrid}>
          <SubjectPicker
            label="시험 종류"
            disabled={busy}
            value={form.examType}
            onChange={(value) => {
              const nextExamType = value as ExamType;
              setForm({ ...form, examType: nextExamType, ...getDefaultCriteria(nextExamType) });
            }}
          />
          <ProviderPicker value={form.provider} env={env} disabled={busy} onChange={provider => setForm({...form,provider})} />
          <CriteriaFields form={form} setForm={setForm} />
          <TextField label="카테고리" value={form.category} onChange={(value) => setForm({ ...form, category: value })} />
          <TextField label="난이도" value={form.difficulty} onChange={(value) => setForm({ ...form, difficulty: value })} />
          <label className={ui.field.group}>
            <span className={ui.field.label}>최대 추출 개수</span>
            <input
              className={ui.field.input}
              max={10}
              min={1}
              type="number"
              value={form.count}
              onChange={(event) => setForm({ ...form, count: Number(event.target.value) })}
            />
          </label>
        </div>

        <label className={ui.uploadClickable}>
          <ImagePlus size={22} />
          <span>JPG, PNG, WEBP 사진 선택</span>
          <input
            accept="image/jpeg,image/png,image/webp"
            className={ui.uploadInput}
            multiple
            onChange={(event) => onPhotoFilesChange(Array.from(event.target.files || []))}
            type="file"
          />
        </label>

        {photoFiles.length > 0 ? (
          <div className={ui.criteria}>
            {photoFiles.map((file, index) => (
              <div className={ui.list.fileRow} key={`${file.name}-${file.lastModified}`}>
                <span className={ui.text.fileName}>{file.name}</span>
                <button
                  aria-label={`${file.name} 제거`}
                  className={ui.button.smallIcon}
                  onClick={() => onPhotoFilesChange(photoFiles.filter((_, fileIndex) => fileIndex !== index))}
                  title="사진 제거"
                  type="button"
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <label className={ui.field.groupWithMargin}>
          <span className={ui.field.label}>추출 요청</span>
          <textarea
            className={ui.field.textarea}
            value={form.instruction}
            onChange={(event) => setForm({ ...form, instruction: event.target.value })}
          />
        </label>

        <div className={ui.layout.actionRow}>
          <button className={ui.button.primary} disabled={busy || photoFiles.length === 0} onClick={onImportPhotos} type="button">
            {busy ? <Loader2 className={ui.icon.spin} size={18} /> : <ImagePlus size={18} />}
            사진에서 추출
          </button>
          <button className={ui.button.secondary} disabled={generatedQuestions.length === 0 || busy} onClick={onSave} type="button">
            <Save size={17} />
            검수 완료 저장
          </button>
        </div>
      </section>

      <section className={ui.panel.surface}>
        <PanelHeader title="사진 변환 검수" icon={ClipboardList} />
        <div className={ui.list.dividerStack}>
          {generatedQuestions.length === 0 ? (
            <EmptyLine label="사진 변환 결과 없음" />
          ) : (
            generatedQuestions.map((question, index) => (
              <article className={ui.list.resultItem} key={`${question.stem}-${index}`}>
                <div className={ui.layout.badgeGroup}>
                  <Badge>{getQuestionTypeLabel(question.type)}</Badge>
                  <Badge>{question.category}</Badge>
                  {question.part ? <Badge>{question.part}</Badge> : null}
                  {question.topic ? <Badge>{question.topic}</Badge> : null}
                  {question.sourcePage ? <Badge>페이지 {question.sourcePage}</Badge> : null}
                  {question.answerStatus === "missing" ? <Badge>정답 확인 필요</Badge> : null}
                </div>
                <textarea
                  className={ui.field.previewStem}
                  value={question.stem}
                  onChange={(event) => onUpdateQuestion(index, { stem: event.target.value, validationErrors: [] })}
                />
                {question.choices.length ? (
                  <ol className={ui.list.choices}>
                    {question.choices.map((choice, choiceIndex) => (
                      <li key={`${index}-${choiceIndex}`}>
                        <input
                          className={ui.field.previewChoice}
                          value={choice}
                          onChange={(event) =>
                            onUpdateQuestion(index, {
                              choices: question.choices.map((item, itemIndex) => itemIndex === choiceIndex ? event.target.value : item),
                              validationErrors: [],
                            })
                          }
                        />
                      </li>
                    ))}
                  </ol>
                ) : null}
                <label className={ui.field.resultGroup}>
                  <span className={ui.field.label}>정답</span>
                  <input
                    className={ui.field.previewAnswer}
                    value={question.answer}
                    onChange={(event) => onUpdateQuestion(index, { answer: event.target.value, answerStatus: event.target.value.trim() ? "confirmed" : "missing", validationErrors: [] })}
                  />
                </label>
                {question.validationErrors?.length ? <p className={ui.text.validationError}>{question.validationErrors.join(" ")}</p> : null}
                {question.extractionConfidence !== undefined ? <p className={ui.text.confidence}>추출 신뢰도 {Math.round(question.extractionConfidence * 100)}%</p> : null}
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function LegacyAiGenerateView({
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
    <div className={ui.layout.panelGrid}>
      <section className={ui.panel.surface}>
        <PanelHeader title="AI 생성" icon={Brain} />
        <div className={ui.layout.fieldGrid}>
          <SubjectPicker
            label="시험 종류"
            disabled={busy}
            value={form.examType}
            onChange={value => setForm({ ...form, examType: value, baseQuestionId: "", ...getDefaultCriteria(value) })}
          />
          <ProviderPicker value={form.provider} env={env} disabled={busy} onChange={provider => setForm({...form,provider})} />
          <CriteriaFields form={form} setForm={setForm} />
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
          <label className={ui.field.group}>
            <span className={ui.field.label}>개수</span>
            <input
              className={ui.field.input}
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

        <label className={ui.field.groupWithMargin}>
          <span className={ui.field.label}>요청</span>
          <textarea
            className={ui.field.textarea}
            value={form.instruction}
            onChange={(event) => setForm({ ...form, instruction: event.target.value })}
          />
        </label>

        <div className={ui.layout.actionRow}>
          <button className={ui.button.primary} disabled={busy} onClick={onGenerate} type="button">
            {busy ? <Loader2 className={ui.icon.spin} size={18} /> : <Sparkles size={18} />}
            생성
          </button>
          <button
            className={ui.button.secondary}
            disabled={generatedQuestions.length === 0 || busy}
            onClick={onSave}
            type="button"
          >
            <Save size={17} />
            저장
          </button>
        </div>
      </section>

      <section className={ui.panel.surface}>
        <PanelHeader title="검수 목록" icon={ClipboardList} />
        <div className={ui.list.dividerStack}>
          {generatedQuestions.length === 0 ? (
            <EmptyLine label="생성 결과 없음" />
          ) : (
            generatedQuestions.map((question, index) => (
              <article className={ui.list.resultItem} key={`${question.stem}-${index}`}>
                <div className={ui.layout.badgeGroup}>
                  <Badge>{getQuestionTypeLabel(question.type)}</Badge>
                  <Badge>{question.category}</Badge>
                  <Badge>{question.difficulty}</Badge>
                  {question.part ? <Badge>{question.part}</Badge> : null}
                  {question.topic ? <Badge>{question.topic}</Badge> : null}
                </div>
                <h3 className={ui.list.resultTitle}>{question.stem}</h3>
                {question.choices.length ? (
                  <ol className={ui.list.simpleChoices}>
                    {question.choices.map((choice) => (
                      <li key={choice}>{choice}</li>
                    ))}
                  </ol>
                ) : null}
                <p className={ui.text.secondary}>
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
    <div className={ui.metric}>
      <span className={ui.text.muted13}>{label}</span>
      <strong className={ui.metricValue}>{value}</strong>
    </div>
  );
}

function PanelHeader({ title, icon: Icon }: { title: string; icon: typeof ClipboardList }) {
  return (
    <div className={ui.section.header}>
      <div className={ui.section.headerContent}>
        <Icon size={18} />
        <h2 className={ui.section.title}>{title}</h2>
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className={ui.badge}>{children}</span>;
}

function EmptyLine({ label }: { label: string }) {
  return <div className={ui.emptyLine}>{label}</div>;
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
    <label className={ui.field.group}>
      <span className={ui.field.label}>{label}</span>
      <input className={ui.field.input} value={value} onChange={(event) => onChange(event.target.value)} />
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
    <label className={ui.field.group}>
      <span className={ui.field.label}>{label}</span>
      <select className={ui.field.select} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}
