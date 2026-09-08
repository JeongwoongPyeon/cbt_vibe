import type { Attempt, Question } from "./types";

const dayKey = (date: Date) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
export function learningMetrics(
  attempts: Attempt[],
  questions: Question[],
  days: 7 | 30,
  now = new Date(),
) {
  const midnight = new Date(`${dayKey(now)}T00:00:00+09:00`).getTime();
  const dates = Array.from({ length: days }, (_, i) =>
    dayKey(new Date(midnight - (days - 1 - i) * 86400000)),
  );
  const buckets = new Map(
    dates.map((date) => [date, { total: 0, correct: 0 }]),
  );
  const questionMap = new Map(
    questions.map((question) => [question.id, question]),
  );
  const units = new Map<
    string,
    { label: string; total: number; correct: number }
  >();
  let total = 0,
    correct = 0;
  for (const attempt of attempts) {
    const question = questionMap.get(attempt.questionId);
    const time = new Date(attempt.createdAt);
    if (
      !question ||
      question.examType !== attempt.examType ||
      !Number.isFinite(time.getTime()) ||
      time > now
    )
      continue;
    const bucket = buckets.get(dayKey(time));
    if (!bucket) continue;
    total++;
    bucket.total++;
    if (attempt.isCorrect) {
      correct++;
      bucket.correct++;
    }
    const key = JSON.stringify([
      question.part?.trim() || "",
      question.unit?.trim() || question.category,
    ]);
    const unit = units.get(key) || {
      label: [question.part?.trim(), question.unit?.trim() || question.category]
        .filter(Boolean)
        .join(" / "),
      total: 0,
      correct: 0,
    };
    unit.total++;
    if (attempt.isCorrect) unit.correct++;
    units.set(key, unit);
  }
  return {
    total,
    correct,
    incorrect: total - correct,
    accuracy: total ? Math.round((correct / total) * 100) : null,
    daily: [...buckets].map(([date, value]) => ({
      date,
      ...value,
      accuracy: value.total
        ? Math.round((value.correct / value.total) * 100)
        : null,
    })),
    units: [...units]
      .map(([key, unit]) => ({
        key,
        ...unit,
        accuracy: Math.round((unit.correct / unit.total) * 100),
      }))
      .sort(
        (a, b) => b.total - a.total || a.label.localeCompare(b.label, "ko"),
      ),
  };
}
