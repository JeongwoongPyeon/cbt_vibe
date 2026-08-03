import { getAppState, insertQuestion } from "@/lib/db";
import type { DraftValidation } from "@/lib/types";
import { validateQuestionDraft } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  const items = Array.isArray(body.questions) ? body.questions : [body];
  const validations: DraftValidation[] = items.map((item: unknown) =>
    validateQuestionDraft(item),
  );
  const errors = validations.flatMap((validation: DraftValidation, index: number) =>
    validation.errors.map((message: string) => `${index + 1}행: ${message}`),
  );

  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  const questions = validations.map((validation: DraftValidation) =>
    insertQuestion(validation.question),
  );
  return Response.json({ questions, state: getAppState(questions[0]?.examType || "ncs") });
}
