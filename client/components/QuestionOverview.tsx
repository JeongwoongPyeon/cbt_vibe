import { Check, Minus, X } from "lucide-react";
import type { Attempt, Question } from "@/lib/types";
import { UNASSIGNED, type QuestionFilters } from "@/lib/study";
import { cn, ui } from "@/lib/ui-classes";
import { SearchFilter } from "./SearchFilter";

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
      <SearchFilter
        label="대단원 필터"
        value={filters.part}
        disabled={disabled}
        options={[
          { value: "", label: "전체 대단원" },
          ...parts.map((value) => ({
            value,
            label: value === UNASSIGNED ? "대단원 미지정" : value,
          })),
        ]}
        onChange={(part) => onChange({ ...filters, part, unit: "" })}
      />
      <SearchFilter
        label="단원 필터"
        value={filters.unit}
        disabled={disabled}
        options={[
          { value: "", label: "전체 단원" },
          ...units.map((value) => ({
            value,
            label: value === UNASSIGNED ? "단원 미지정" : value,
          })),
        ]}
        onChange={(unit) => onChange({ ...filters, unit })}
      />
      <div className={ui.study.filter}>
        <span className={ui.field.label}>풀이 상태</span>
        <div
          className={ui.filters.segments}
          role="group"
          aria-label="풀이 상태"
        >
          {(
            [
              ["all", "전체"],
              ["solved", "푼 문제"],
              ["unsolved", "미풀이"],
            ] as const
          ).map(([status, label]) => (
            <button
              key={status}
              type="button"
              disabled={disabled}
              aria-pressed={filters.status === status}
              className={cn(
                ui.filters.segment,
                filters.status === status && ui.filters.active,
              )}
              onClick={() => onChange({ ...filters, status })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {(filters.part || filters.unit || filters.status !== "all") && (
        <button
          type="button"
          disabled={disabled}
          className={ui.button.icon}
          title="필터 초기화"
          aria-label="필터 초기화"
          onClick={() => onChange({ part: "", unit: "", status: "all" })}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
