import { createContext, useContext, useId, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  BookOpen,
  CheckCircle2,
  ChevronsUpDown,
  Monitor,
  ShieldCheck,
} from "lucide-react";
import type { ExamType, SubjectSummary } from "@/lib/types";
import { cn, ui } from "@/lib/ui-classes";

export const SubjectsContext = createContext<SubjectSummary[]>([]);
export const subjectIcons = {
  ncs: BookOpen,
  computer_general: Monitor,
  information_security: ShieldCheck,
};

export function SubjectPicker({
  value,
  onChange,
  disabled,
  compact = false,
  label = "과목",
}: {
  value: ExamType;
  onChange: (value: ExamType) => void;
  disabled?: boolean;
  compact?: boolean;
  label?: string;
}) {
  const subjects = useContext(SubjectsContext).filter(
    (subject) => subject.active,
  );
  const group = useId();
  const [open, setOpen] = useState(false);
  const selected = subjects.find((subject) => subject.id === value);
  const CurrentIcon = subjectIcons[value];
  const choices = (
    <div
      className={compact ? ui.subjects.list : ui.subjects.grid}
      role="group"
      aria-label={label}
    >
      {subjects.map((subject) => {
        const Icon = subjectIcons[subject.id];
        return (
          <label
            key={subject.id}
            className={cn(
              ui.subjects.choice,
              value === subject.id && ui.subjects.selected,
              disabled && ui.subjects.disabled,
            )}
          >
            <input
              className={ui.subjects.radio}
              type="radio"
              name={group}
              value={subject.id}
              checked={value === subject.id}
              disabled={disabled}
              onChange={() => {
                onChange(subject.id);
              }}
            />
            <Icon size={21} aria-hidden="true" />
            <span className={ui.subjects.copy}>
              <strong>{subject.label}</strong>
              <span className={ui.text.muted13}>
                {subject.questions}문항 · {subject.attempts}회 풀이
              </span>
            </span>
            {value === subject.id && (
              <CheckCircle2 size={17} aria-hidden="true" />
            )}
          </label>
        );
      })}
    </div>
  );
  if (!compact)
    return (
      <div className={cn(ui.field.group, ui.subjects.full)}>
        <span className={ui.field.label}>{label}</span>
        {choices}
      </div>
    );
  return (
    <Popover.Root open={open && !disabled} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={ui.subjects.trigger}
          disabled={disabled || !subjects.length}
          type="button"
          aria-label={`과목 선택: ${selected?.label || "과목 없음"}`}
        >
          <CurrentIcon size={18} />
          {selected?.label || "과목 없음"}
          <ChevronsUpDown size={15} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={ui.subjects.popover}
          sideOffset={8}
          align="end"
          collisionPadding={16}
        >
          {choices}
          <Popover.Close asChild>
            <button type="button" className={ui.button.secondary}>
              선택 완료
            </button>
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
