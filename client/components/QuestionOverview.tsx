import { Check, Minus, X } from "lucide-react";
import type { Attempt, Question } from "@/lib/types";
import { UNASSIGNED, type QuestionFilters } from "@/lib/study";
import { cn, ui } from "@/lib/ui-classes";

export function RecentHistory({ attempts = [] }: { attempts?: Attempt[] }) {
  return (
    <span
      className={ui.study.history}
      role="group"
      aria-label="최근 5회 정오답 (최신순)"
    >
      {Array.from({ length: 5 }, (_, index) => {
        const attempt = attempts[index];
        const label = attempt
          ? `${index + 1}번째 최근 풀이: ${attempt.isCorrect ? "정답" : "오답"} · ${new Date(attempt.createdAt).toLocaleString("ko-KR")} · ${attempt.mode === "exam" ? "모의고사" : "학습"}`
          : `${index + 1}번째 기록 없음`;
        const Icon = attempt ? (attempt.isCorrect ? Check : X) : Minus;
        return (
          <span
            key={index}
            role="img"
            title={label}
            aria-label={label}
            className={cn(
              ui.study.historySlot,
              attempt
                ? attempt.isCorrect
                  ? ui.study.correct
                  : ui.study.incorrect
                : ui.study.pending,
            )}
          >
            <Icon size={14} />
          </span>
        );
      })}
    </span>
  );
}

export function QuestionProgress({ attempts = [] }: { attempts?: Attempt[] }) {
  return (
    <span className={ui.study.meta}>
      <span className={attempts.length ? ui.study.solved : ui.study.unsolved}>
        {attempts.length ? "푼 문제" : "미풀이"}
      </span>
      <RecentHistory attempts={attempts} />
    </span>
  );
}

export function QuestionFilterBar({
  questions,
  filters,
  onChange,
  disabled = false,
}: {
  questions: Question[];
  filters: QuestionFilters;
  onChange: (filters: QuestionFilters) => void;
  disabled?: boolean;
}) {
  const parts = [
    ...new Set(
      questions.map((question) => question.part?.trim() || UNASSIGNED),
    ),
  ].sort();
  const units = [
    ...new Set(
      questions
        .filter(
          (question) =>
            !filters.part ||
            (question.part?.trim() || UNASSIGNED) === filters.part,
        )
        .map((question) => question.unit?.trim() || UNASSIGNED),
    ),
  ].sort();
  return (
    <div className={ui.study.toolbar}>
      <label className={ui.study.filter}>
        <span className={ui.field.label}>대단원 필터</span>
        <select
          className={ui.field.select}
          value={filters.part}
          disabled={disabled}
          onChange={(e) =>
            onChange({ ...filters, part: e.target.value, unit: "" })
          }
        >
          <option value="">전체 대단원</option>
          {parts.map((part) => (
            <option key={part} value={part}>
              {part === UNASSIGNED ? "대단원 미지정" : part}
            </option>
          ))}
        </select>
      </label>
      <label className={ui.study.filter}>
        <span className={ui.field.label}>단원 필터</span>
        <select
          className={ui.field.select}
          value={filters.unit}
          disabled={disabled}
          onChange={(e) => onChange({ ...filters, unit: e.target.value })}
        >
          <option value="">전체 단원</option>
          {units.map((unit) => (
            <option key={unit} value={unit}>
              {unit === UNASSIGNED ? "단원 미지정" : unit}
            </option>
          ))}
        </select>
      </label>
      <label className={ui.study.filter}>
        <span className={ui.field.label}>풀이 상태</span>
        <select
          className={ui.field.select}
          value={filters.status}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              ...filters,
              status: e.target.value as QuestionFilters["status"],
            })
          }
        >
          <option value="all">전체 문제</option>
          <option value="solved">푼 문제</option>
          <option value="unsolved">풀지 않은 문제</option>
        </select>
      </label>
    </div>
  );
}
