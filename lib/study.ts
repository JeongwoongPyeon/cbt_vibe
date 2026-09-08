import type { Attempt, Question } from "./types";

export type QuestionFilters = {
  part: string;
  unit: string;
  status: "all" | "solved" | "unsolved";
};
export const emptyFilters: QuestionFilters = {
  part: "",
  unit: "",
  status: "all",
};
export const UNASSIGNED = "__unassigned__";
const normalize = (value?: string) => (value || "").trim().toLocaleLowerCase();

export function attemptHistory(attempts: Attempt[]): Map<string, Attempt[]> {
  const history = new Map<string, Attempt[]>();
  for (const attempt of [...attempts].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )) {
    const recent = history.get(attempt.questionId) || [];
    if (recent.length < 5) recent.push(attempt);
    history.set(attempt.questionId, recent);
  }
  return history;
}

export function filterQuestions(
  questions: Question[],
  attempts: Attempt[],
  filters: QuestionFilters,
  search = "",
) {
  const solved = new Set(attempts.map((attempt) => attempt.questionId));
  const matches = (value: string | undefined, selected: string) =>
    !selected ||
    (selected === UNASSIGNED ? !value?.trim() : value?.trim() === selected);
  const term = normalize(search);
  return questions.filter(
    (question) =>
      matches(question.part, filters.part) &&
      matches(question.unit, filters.unit) &&
      (filters.status === "all" ||
        solved.has(question.id) === (filters.status === "solved")) &&
      (!term ||
        normalize(
          [
            question.stem,
            question.category,
            question.part,
            question.unit,
            question.topic,
            question.difficulty,
            question.sourceType,
            ...question.tags,
          ].join(" "),
        ).includes(term)),
  );
}

export function similarQuestions(
  base: Question,
  questions: Question[],
  limit = 5,
) {
  return questions
    .filter(
      (question) =>
        question.id !== base.id && question.examType === base.examType,
    )
    .map((question) => {
      const samePart = normalize(base.part) === normalize(question.part);
      const sameUnit =
        samePart &&
        !!normalize(base.unit) &&
        normalize(base.unit) === normalize(question.unit);
      const sameTopic =
        samePart &&
        normalize(base.unit) === normalize(question.unit) &&
        !!normalize(base.topic) &&
        normalize(base.topic) === normalize(question.topic);
      const sameCategory =
        !!normalize(base.category) &&
        normalize(base.category) !== "미분류" &&
        normalize(base.category) === normalize(question.category);
      const tags = new Set(base.tags.map(normalize).filter(Boolean));
      const sharedTags = [...new Set(question.tags.map(normalize))].filter(
        (tag) => tags.has(tag),
      );
      const reasons = [
        sameTopic && "같은 세부 주제",
        sameUnit && "같은 단원",
        samePart && !!normalize(base.part) && "같은 대단원",
        sameCategory && "같은 카테고리",
        sharedTags.length > 0 && "공통 태그",
      ].filter(Boolean) as string[];
      const score =
        (sameTopic ? 60 : 0) +
        (sameUnit ? 40 : 0) +
        (samePart && normalize(base.part) ? 15 : 0) +
        (sameCategory ? 10 : 0) +
        Math.min(sharedTags.length, 5) * 2;
      return { question, reasons, score };
    })
    .filter((item) => item.score > 0)
    .sort(
      (a, b) => b.score - a.score || a.question.id.localeCompare(b.question.id),
    )
    .slice(0, limit);
}

export function selectExamQuestions(
  questions: Question[],
  count: number,
  random = Math.random,
) {
  const shuffled = [...questions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.max(0, Math.min(100, Math.floor(count))));
}
