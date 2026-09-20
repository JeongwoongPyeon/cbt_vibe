import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { AppState, ExamType, SubjectSummary } from "@/lib/types";
import { ui } from "@/lib/ui-classes";
import { subjectIcons } from "./SubjectPicker";

export function SubjectManager({
  subjects,
  disabled,
  onChange,
}: {
  subjects: SubjectSummary[];
  disabled?: boolean;
  onChange: (state: AppState, deleted?: ExamType) => void;
}) {
  const [target, setTarget] = useState<SubjectSummary | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (target) {
      dialog.current?.showModal();
      cancel.current?.focus();
    } else dialog.current?.close();
  }, [target]);
  async function mutate(subject: SubjectSummary, remove: boolean) {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/subjects", {
        method: remove ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: subject.id,
          confirmation,
          expected: {
            questions: subject.questions,
            attempts: subject.attempts,
            wrongNotes: subject.wrongNotes,
          },
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "과목 변경에 실패했습니다.");
      onChange(result.state, remove ? subject.id : undefined);
      setTarget(null);
      setConfirmation("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "과목 변경에 실패했습니다.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className={ui.subjects.section} aria-label="과목 관리">
      <h2 className={ui.study.heading}>과목 관리</h2>
      {error && !target && (
        <p role="alert" className={ui.text.validationError}>
          {error}
        </p>
      )}
      <div className={ui.subjects.grid}>
        {subjects.map((subject) => {
          const Icon = subjectIcons[subject.id];
          return (
            <article className={ui.subjects.card} key={subject.id}>
              <div className={ui.study.actions}>
                <Icon size={20} />
                <strong>{subject.label}</strong>
              </div>
              <span className={ui.text.muted13}>
                {subject.active
                  ? `${subject.questions}문항 · ${subject.attempts}회 풀이 · 오답노트 ${subject.wrongNotes}개`
                  : "삭제된 과목"}
              </span>
              {subject.active ? (
                <button
                  className={ui.subjects.danger}
                  type="button"
                  disabled={disabled || pending}
                  onClick={() => {
                    setTarget(subject);
                    setConfirmation("");
                    setError("");
                  }}
                  aria-label={`${subject.label} 삭제`}
                >
                  <Trash2 size={16} />
                  삭제
                </button>
              ) : (
                <button
                  className={ui.button.secondary}
                  type="button"
                  disabled={disabled || pending}
                  onClick={() => void mutate(subject, false)}
                  aria-label={`${subject.label} 다시 추가`}
                >
                  <Plus size={16} />빈 과목으로 다시 추가
                </button>
              )}
            </article>
          );
        })}
      </div>
      <dialog
        ref={dialog}
        className={ui.subjects.dialog}
        aria-labelledby="delete-subject-title"
        onCancel={(event) => {
          if (pending) event.preventDefault();
          else setTarget(null);
        }}
      >
        {target && (
          <div className={ui.subjects.list}>
            <h2 id="delete-subject-title" className={ui.study.heading}>
              {target.label} 삭제
            </h2>
            <p>
              문제 {target.questions}개, 풀이 기록 {target.attempts}개, 오답노트{" "}
              {target.wrongNotes}개와 관련 모의고사 제출 기록을 영구 삭제합니다.
              이 작업은 되돌릴 수 없습니다.
            </p>
            <label className={ui.field.group}>
              <span className={ui.field.label}>
                확인을 위해 ‘{target.label}’ 입력
              </span>
              <input
                className={ui.field.input}
                value={confirmation}
                disabled={pending}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className={ui.text.validationError}>
                {error}
              </p>
            )}
            <div className={ui.study.actions}>
              <button
                ref={cancel}
                type="button"
                className={ui.button.secondary}
                disabled={pending}
                onClick={() => setTarget(null)}
              >
                취소
              </button>
              <button
                type="button"
                className={ui.subjects.danger}
                disabled={pending || confirmation !== target.label}
                onClick={() => void mutate(target, true)}
              >
                <Trash2 size={16} />
                {pending ? "삭제 중…" : "영구 삭제"}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </section>
  );
}
