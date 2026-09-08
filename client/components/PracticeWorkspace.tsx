import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  Flag,
  ListFilter,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AppState, Attempt, ExamType, Question } from "@/lib/types";
import {
  attemptHistory,
  emptyFilters,
  selectExamQuestions,
  similarQuestions,
  type QuestionFilters,
} from "@/lib/study";
import {
  freezeSubmission,
  parseExamSession,
  settleExamTime,
  type ExamSession,
} from "@/lib/exam";
import {
  answerChoice,
  cn,
  feedbackBanner,
  questionListItem,
  tabButton,
  ui,
} from "@/lib/ui-classes";
import { getQuestionTypeLabel } from "@/lib/validation";
import {
  QuestionFilterBar,
  QuestionProgress,
  RecentHistory,
} from "./QuestionOverview";

type Props = {
  examType: ExamType;
  questions: Question[];
  filteredQuestions: Question[];
  attempts: Attempt[];
  activeQuestionId: string;
  filters: QuestionFilters;
  onChoose: (id: string) => void;
  onFilterChange: (filters: QuestionFilters) => void;
  onClearSearch: () => void;
  onGenerateSimilar: (question: Question) => void;
  onStateChange: (state: AppState) => void;
  onLockChange: (locked: boolean) => void;
};

export function PracticeWorkspace(props: Props) {
  const {
    examType,
    questions,
    filteredQuestions,
    attempts,
    filters,
    onChoose,
    onFilterChange,
    onStateChange,
    onLockChange,
  } = props;
  const storageKey = `cbt.exam.v1.${examType}`;
  const [session, setSession] = useState<ExamSession | null>(() => {
    try {
      return parseExamSession(localStorage.getItem(storageKey), examType);
    } catch {
      return null;
    }
  });
  const [mode, setMode] = useState<"study" | "exam">(
    session ? "exam" : "study",
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, Attempt>>({});
  const [count, setCount] = useState(20);
  const [minutes, setMinutes] = useState(30);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const startedAt = useRef(Date.now());
  const history = useMemo(() => attemptHistory(attempts), [attempts]);
  const byId = useMemo(
    () => new Map(questions.map((q) => [q.id, q])),
    [questions],
  );
  const pool = session
    ? session.questionIds
        .map((id) => byId.get(id))
        .filter((q): q is Question => !!q)
    : filteredQuestions;
  const activeId = session?.activeId || props.activeQuestionId;
  const current =
    pool.find((q) => q.id === activeId) ||
    (mode === "study" && results[activeId] ? byId.get(activeId) : undefined) ||
    pool[0];
  const index = pool.findIndex((q) => q.id === current?.id);
  const running = !!session && !session.result;
  const frozen =
    busy || !!session?.submission || (!!session && now >= session.deadline);
  const answer = current
    ? session
      ? session.answers[current.id] || ""
      : drafts[current.id] || ""
    : "";
  const result = current
    ? session?.result?.find((a) => a.questionId === current.id) ||
      (mode === "study" ? results[current.id] : undefined)
    : undefined;
  const related = useMemo(
    () => (current ? similarQuestions(current, questions) : []),
    [current, questions],
  );
  const answeredCount = session
    ? session.questionIds.filter((id) => session.answers[id]?.trim()).length
    : 0;
  const remaining = session
    ? Math.max(0, Math.ceil((session.deadline - now) / 1000))
    : 0;

  function persist(next: ExamSession | null) {
    sessionRef.current = next;
    setSession(next);
    try {
      if (next) localStorage.setItem(storageKey, JSON.stringify(next));
      else localStorage.removeItem(storageKey);
    } catch {
      setStorageWarning(
        "임시 저장 공간에 접근할 수 없습니다. 페이지를 닫으면 진행 중인 답안이 사라질 수 있습니다.",
      );
    }
  }

  useEffect(() => {
    onLockChange(running);
    return () => onLockChange(false);
  }, [running, onLockChange]);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      clearInterval(timer);
      window.removeEventListener("beforeunload", warn);
    };
  }, [running]);
  useEffect(() => {
    startedAt.current = Date.now();
  }, [current?.id]);
  useEffect(() => {
    if (confirmSubmit) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirmSubmit]);
  useEffect(() => {
    if (
      session &&
      !session.result &&
      !session.submission &&
      now >= session.deadline
    )
      void submitExam();
  }, [now, session]);
  useEffect(() => {
    if (sessionRef.current?.submission && !sessionRef.current.result)
      void submitExam();
  }, []);

  function choose(id: string) {
    if (busy) return;
    if (session)
      persist({
        ...(session.result || session.submission
          ? session
          : settleExamTime(session)),
        activeId: id,
      });
    else onChoose(id);
  }

  function changeAnswer(value: string) {
    if (!current || frozen || result) return;
    if (session) {
      if (Date.now() >= session.deadline) {
        setNow(Date.now());
        return;
      }
      persist({
        ...settleExamTime(session),
        answers: { ...session.answers, [current.id]: value },
      });
    } else setDrafts({ ...drafts, [current.id]: value });
  }

  async function grade() {
    if (!current || !answer.trim() || result || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    const question = current;
    try {
      const response = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          selectedAnswer: answer,
          elapsedSeconds: Math.round((Date.now() - startedAt.current) / 1000),
          mode: "practice",
        }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "채점에 실패했습니다.");
      setResults((previous) => ({
        ...previous,
        [question.id]: payload.attempt,
      }));
      onChoose(question.id);
      onStateChange(payload.state);
    } catch (e) {
      setError(e instanceof Error ? e.message : "채점에 실패했습니다.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  function startExam() {
    if (
      running ||
      !filteredQuestions.length ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > 100 ||
      !Number.isInteger(minutes) ||
      minutes < 1 ||
      minutes > 180
    )
      return;
    const selected = selectExamQuestions(filteredQuestions, count);
    const start = Date.now();
    persist({
      id: crypto.randomUUID(),
      examType,
      questionIds: selected.map((q) => q.id),
      activeId: selected[0].id,
      answers: {},
      flagged: [],
      spentMs: {},
      filters: { ...filters },
      startedAt: start,
      activeSince: start,
      deadline: start + minutes * 60000,
    });
    setNow(start);
    setError("");
  }

  async function submitExam() {
    const currentSession = sessionRef.current;
    if (!currentSession || currentSession.result || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    setConfirmSubmit(false);
    const frozenSession = freezeSubmission(currentSession);
    persist(frozenSession);
    try {
      const response = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(frozenSession.submission),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "시험 제출에 실패했습니다.");
      persist({ ...frozenSession, result: payload.attempts });
      onStateChange(payload.state);
    } catch (e) {
      setError(
        e instanceof TypeError
          ? "제출 결과를 확인하지 못했습니다. 다시 제출해 주세요."
          : e instanceof Error
            ? e.message
            : "시험 제출에 실패했습니다. 다시 제출해 주세요.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <div className={ui.study.workspace}>
      <div className={ui.study.row}>
        <div className={ui.layout.tabBar} role="tablist" aria-label="풀이 모드">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "study"}
            className={tabButton(mode === "study")}
            disabled={running || busy}
            onClick={() => {
              setMode("study");
              persist(null);
              setError("");
            }}
          >
            <BookOpen size={16} />
            학습모드
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "exam"}
            className={tabButton(mode === "exam")}
            disabled={busy}
            onClick={() => {
              setMode("exam");
              setError("");
            }}
          >
            <Clock size={16} />
            모의고사
          </button>
        </div>
        {mode === "study" && (
          <span className={ui.text.muted13}>최근 5회 · 최신순</span>
        )}
      </div>
      <QuestionFilterBar
        questions={questions}
        filters={session?.filters || filters}
        onChange={onFilterChange}
        disabled={!!session || busy}
      />
      {error && (
        <div role="alert" className={ui.study.error}>
          {error}
        </div>
      )}
      {storageWarning && (
        <div role="status" className={ui.study.error}>
          {storageWarning}
        </div>
      )}
      {mode === "exam" && !session ? (
        <div className={ui.study.setup}>
          <label className={ui.study.number}>
            <span className={ui.field.label}>문항 수</span>
            <input
              className={ui.field.input}
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </label>
          <label className={ui.study.number}>
            <span className={ui.field.label}>제한시간 (분)</span>
            <input
              className={ui.field.input}
              type="number"
              min={1}
              max={180}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
          </label>
          <span className={ui.text.muted13}>
            출제 가능 {filteredQuestions.length}문항 · 선택{" "}
            {Math.min(filteredQuestions.length, Math.max(0, count))}문항
          </span>
          <button
            className={ui.button.primary}
            type="button"
            onClick={startExam}
            disabled={
              !filteredQuestions.length ||
              !Number.isInteger(count) ||
              count < 1 ||
              count > 100 ||
              !Number.isInteger(minutes) ||
              minutes < 1 ||
              minutes > 180
            }
          >
            <Clock size={16} />
            시험 시작
          </button>
        </div>
      ) : (
        <>
          {session && (
            <div className={ui.study.result}>
              {session.result ? (
                <>
                  <strong className={ui.study.score}>
                    {Math.round(
                      (session.result.filter((a) => a.isCorrect).length /
                        session.result.length) *
                        100,
                    )}
                    점
                  </strong>
                  <span>
                    정답 {session.result.filter((a) => a.isCorrect).length} /{" "}
                    {session.result.length}
                  </span>
                  <span className={ui.text.muted13}>
                    미응답 {session.questionIds.length - answeredCount}
                  </span>
                  <button
                    className={ui.button.secondary}
                    type="button"
                    onClick={() => {
                      persist(null);
                      setError("");
                    }}
                  >
                    <RotateCcw size={16} />새 모의고사
                  </button>
                </>
              ) : (
                <>
                  <span
                    className={ui.study.timer}
                    role="timer"
                    aria-label="남은 시간"
                  >
                    <Clock size={16} />
                    {String(Math.floor(remaining / 60)).padStart(2, "0")}:
                    {String(remaining % 60).padStart(2, "0")}
                  </span>
                  <span className={ui.text.sm}>
                    응답 {answeredCount} / {session.questionIds.length} · 미응답{" "}
                    {session.questionIds.length - answeredCount}
                  </span>
                  <button
                    className={ui.button.primary}
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      session.submission
                        ? void submitExam()
                        : setConfirmSubmit(true)
                    }
                  >
                    {busy ? (
                      <Loader2 size={16} className={ui.icon.spin} />
                    ) : (
                      <Send size={16} />
                    )}
                    {session.submission ? "다시 제출" : "시험 제출"}
                  </button>
                </>
              )}
            </div>
          )}
          <div className={ui.study.body}>
            <section className={ui.study.main} aria-label="현재 문항">
              {current ? (
                <>
                  <div className={ui.study.row}>
                    <div className={ui.layout.badgeGroup}>
                      <span className={ui.badge}>
                        {getQuestionTypeLabel(current.type)}
                      </span>
                      <span className={ui.badge}>{current.category}</span>
                      <span className={ui.badge}>{current.difficulty}</span>
                    </div>
                    {session && !session.result && (
                      <button
                        className={cn(
                          ui.button.icon,
                          session.flagged.includes(current.id) &&
                            ui.study.flagged,
                        )}
                        aria-label="검토 표시"
                        aria-pressed={session.flagged.includes(current.id)}
                        title="검토 표시"
                        type="button"
                        disabled={frozen}
                        onClick={() =>
                          persist({
                            ...session,
                            flagged: session.flagged.includes(current.id)
                              ? session.flagged.filter(
                                  (id) => id !== current.id,
                                )
                              : [...session.flagged, current.id],
                          })
                        }
                      >
                        <Flag size={17} />
                      </button>
                    )}
                  </div>
                  <p className={ui.study.meta}>
                    {[current.part, current.unit, current.topic]
                      .filter(Boolean)
                      .join(" / ") || "단원 미지정"}
                  </p>
                  <h2 className={ui.study.question}>{current.stem}</h2>
                  {current.type === "short_answer" ? (
                    <label className={ui.field.group}>
                      <span className={ui.field.label}>답안</span>
                      <input
                        className={ui.field.answer}
                        value={answer}
                        disabled={frozen || !!result}
                        onChange={(e) => changeAnswer(e.target.value)}
                        placeholder="답안 입력"
                      />
                    </label>
                  ) : (
                    <div
                      className={ui.list.answerChoices}
                      role="group"
                      aria-label="답안 선택"
                    >
                      {current.choices.map((choice, i) => (
                        <button
                          type="button"
                          key={`${i}-${choice}`}
                          className={answerChoice(answer === choice)}
                          disabled={frozen || !!result}
                          aria-pressed={answer === choice}
                          onClick={() => changeAnswer(choice)}
                        >
                          <span className={ui.answerChoice.marker}>
                            {i + 1}
                          </span>
                          <span className={ui.text.question}>{choice}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {result && (
                    <div
                      className={feedbackBanner(result.isCorrect)}
                      role="status"
                    >
                      <strong>
                        {result.isCorrect
                          ? "정답"
                          : result.selectedAnswer.trim()
                            ? "오답"
                            : "미응답 · 오답"}
                      </strong>
                      <p className={ui.study.explanation}>
                        정답: {current.answer}
                      </p>
                      <p className={ui.study.explanation}>
                        {current.explanation}
                      </p>
                    </div>
                  )}
                  {mode === "study" && (
                    <div className={ui.study.navigation}>
                      {result ? (
                        <button
                          type="button"
                          className={ui.button.secondary}
                          onClick={() => {
                            setResults((previous) => {
                              const next = { ...previous };
                              delete next[current.id];
                              return next;
                            });
                            setDrafts((previous) => ({
                              ...previous,
                              [current.id]: "",
                            }));
                            startedAt.current = Date.now();
                          }}
                        >
                          <RotateCcw size={16} />
                          다시 풀기
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={ui.button.primary}
                          disabled={!answer.trim() || busy}
                          onClick={() => void grade()}
                        >
                          {busy ? (
                            <Loader2 size={16} className={ui.icon.spin} />
                          ) : (
                            <Check size={16} />
                          )}
                          채점
                        </button>
                      )}
                      <RecentHistory attempts={history.get(current.id)} />
                    </div>
                  )}
                  <div className={ui.study.navigation}>
                    <button
                      className={ui.button.icon}
                      aria-label="이전 문제"
                      title="이전 문제"
                      type="button"
                      disabled={index <= 0 || busy}
                      onClick={() => choose(pool[index - 1].id)}
                    >
                      <ArrowLeft size={18} />
                    </button>
                    <span className={ui.study.counter}>
                      {index < 0
                        ? "채점 완료"
                        : `${index + 1} / ${pool.length}`}
                    </span>
                    <button
                      className={ui.button.icon}
                      aria-label="다음 문제"
                      title="다음 문제"
                      type="button"
                      disabled={
                        !pool.length || index >= pool.length - 1 || busy
                      }
                      onClick={() => choose(pool[index + 1].id)}
                    >
                      <ArrowRight size={18} />
                    </button>
                  </div>
                  {mode === "study" && (
                    <section className={ui.study.related} aria-label="유사문제">
                      <div className={ui.study.row}>
                        <h3 className={ui.study.heading}>유사문제</h3>
                        <button
                          type="button"
                          className={ui.button.secondary}
                          disabled={busy}
                          onClick={() => props.onGenerateSimilar(current)}
                        >
                          <Sparkles size={16} />
                          AI로 새 문제 생성
                        </button>
                      </div>
                      {related.length ? (
                        related.map(({ question, reasons }) => (
                          <button
                            type="button"
                            className={ui.study.relatedItem}
                            disabled={busy}
                            key={question.id}
                            onClick={() => {
                              onFilterChange(emptyFilters);
                              props.onClearSearch();
                              onChoose(question.id);
                            }}
                          >
                            <span className={ui.text.muted13}>
                              {reasons.join(" · ")}
                            </span>
                            <span className={ui.text.question}>
                              {question.stem}
                            </span>
                            <QuestionProgress
                              attempts={history.get(question.id)}
                            />
                          </button>
                        ))
                      ) : (
                        <p className={ui.emptyLine}>
                          관련 단원에 등록된 다른 문제가 없습니다.
                        </p>
                      )}
                    </section>
                  )}
                </>
              ) : (
                <p className={ui.emptyLine}>조건에 맞는 문제가 없습니다.</p>
              )}
            </section>
            <aside className={ui.study.aside} aria-label="문제 목록">
              <div className={ui.study.row}>
                <h3 className={ui.study.heading}>
                  {session ? "답안표" : "문제 목록"}
                </h3>
                <span className={ui.text.muted13}>{pool.length}문항</span>
              </div>
              {session ? (
                <div className={ui.study.numberGrid}>
                  {pool.map((question, i) => {
                    const submitted = session.result?.find(
                      (a) => a.questionId === question.id,
                    );
                    return (
                      <button
                        key={question.id}
                        type="button"
                        className={cn(
                          ui.study.numberButton,
                          submitted
                            ? submitted.isCorrect
                              ? ui.study.correct
                              : ui.study.incorrect
                            : session.answers[question.id]?.trim()
                              ? ui.study.numberAnswered
                              : ui.study.pending,
                          current?.id === question.id && ui.study.numberActive,
                        )}
                        disabled={busy}
                        title={`${i + 1}번 · ${submitted ? (submitted.isCorrect ? "정답" : "오답") : session.answers[question.id]?.trim() ? "응답" : "미응답"}`}
                        aria-label={`${i + 1}번 문제${session.flagged.includes(question.id) ? " · 검토" : ""}`}
                        aria-current={
                          current?.id === question.id ? "true" : undefined
                        }
                        onClick={() => choose(question.id)}
                      >
                        {i + 1}
                        {session.flagged.includes(question.id) && (
                          <Flag className={ui.study.flag} size={10} />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className={ui.study.list}>
                  {pool.map((question) => (
                    <button
                      key={question.id}
                      type="button"
                      className={questionListItem(current?.id === question.id)}
                      disabled={busy}
                      aria-current={
                        current?.id === question.id ? "true" : undefined
                      }
                      onClick={() => choose(question.id)}
                    >
                      <span className={ui.list.questionMeta}>
                        {question.unit || question.part || question.category}
                      </span>
                      <strong className={ui.list.questionTitle}>
                        {question.stem}
                      </strong>
                      <QuestionProgress attempts={history.get(question.id)} />
                    </button>
                  ))}
                  {!pool.length && (
                    <span className={ui.emptyLine}>
                      <ListFilter size={16} />
                      0문항
                    </span>
                  )}
                </div>
              )}
            </aside>
          </div>
        </>
      )}
      <dialog
        ref={dialog}
        className={ui.study.dialog}
        onCancel={() => setConfirmSubmit(false)}
        aria-labelledby="submit-exam-title"
      >
        <h2 id="submit-exam-title" className={ui.study.heading}>
          시험을 제출할까요?
        </h2>
        <p className={ui.study.explanation}>
          전체 {session?.questionIds.length || 0}문항 · 미응답{" "}
          {(session?.questionIds.length || 0) - answeredCount}문항 · 검토{" "}
          {session?.flagged.length || 0}문항
        </p>
        <div className={ui.study.navigation}>
          <button
            type="button"
            className={ui.button.secondary}
            onClick={() => setConfirmSubmit(false)}
          >
            계속 풀기
          </button>
          <button
            type="button"
            className={ui.button.primary}
            onClick={() => void submitExam()}
          >
            <Send size={16} />
            제출 확정
          </button>
        </div>
      </dialog>
    </div>
  );
}
