import { z } from "zod";
import type { Attempt, ExamType } from "./types";
import type { QuestionFilters } from "./study";

export const examSubmissionSchema = z.object({
  submissionId: z.string().uuid(),
  responses: z
    .array(
      z.object({
        questionId: z.string().min(1),
        selectedAnswer: z.string().max(10000),
        elapsedSeconds: z.number().int().min(0).max(86400),
      }),
    )
    .min(1)
    .max(100),
});
export type ExamSubmission = z.infer<typeof examSubmissionSchema>;

export interface ExamSession {
  id: string;
  examType: ExamType;
  questionIds: string[];
  activeId: string;
  answers: Record<string, string>;
  flagged: string[];
  startedAt: number;
  deadline: number;
  activeSince: number;
  spentMs: Record<string, number>;
  submission?: ExamSubmission;
  result?: Attempt[];
  filters?: QuestionFilters;
}

export function settleExamTime(
  session: ExamSession,
  now = Date.now(),
): ExamSession {
  const until = Math.min(now, session.deadline);
  return {
    ...session,
    activeSince: until,
    spentMs: {
      ...session.spentMs,
      [session.activeId]:
        (session.spentMs[session.activeId] || 0) +
        Math.max(0, until - session.activeSince),
    },
  };
}

export function freezeSubmission(
  session: ExamSession,
  now = Date.now(),
): ExamSession {
  if (session.submission) return session;
  const settled = settleExamTime(session, now);
  return {
    ...settled,
    submission: {
      submissionId: session.id,
      responses: session.questionIds.map((questionId) => ({
        questionId,
        selectedAnswer: session.answers[questionId] || "",
        elapsedSeconds: Math.min(
          86400,
          Math.round((settled.spentMs[questionId] || 0) / 1000),
        ),
      })),
    },
  };
}

const storedSessionSchema = z.object({
  id: z.string().uuid(),
  examType: z.enum(["ncs", "computer_general", "information_security"]),
  questionIds: z.array(z.string()).min(1).max(100),
  activeId: z.string(),
  answers: z.record(z.string(), z.string()),
  flagged: z.array(z.string()),
  startedAt: z.number().finite(),
  deadline: z.number().finite(),
  activeSince: z.number().finite(),
  spentMs: z.record(z.string(), z.number().nonnegative()),
  submission: examSubmissionSchema.optional(),
  filters: z
    .object({
      part: z.string(),
      unit: z.string(),
      status: z.enum(["all", "solved", "unsolved"]),
    })
    .optional(),
  result: z
    .array(
      z.object({
        id: z.string(),
        questionId: z.string(),
        examType: z.enum(["ncs", "computer_general", "information_security"]),
        selectedAnswer: z.string(),
        isCorrect: z.boolean(),
        elapsedSeconds: z.number(),
        mode: z.enum(["practice", "exam", "review"]),
        createdAt: z.string(),
      }),
    )
    .optional(),
});

export function parseExamSession(
  raw: string | null,
  examType: ExamType,
): ExamSession | null {
  try {
    const result = storedSessionSchema.safeParse(JSON.parse(raw || "null"));
    if (!result.success) return null;
    const session = result.data;
    if (
      session.examType !== examType ||
      !session.questionIds.includes(session.activeId) ||
      new Set(session.questionIds).size !== session.questionIds.length ||
      session.deadline <= session.startedAt
    )
      return null;
    return session;
  } catch {
    return null;
  }
}
