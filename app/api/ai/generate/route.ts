import { generateQuestions } from "@/lib/ai";
import { getQuestionById } from "@/lib/db";
import { normalizeExamType, normalizeQuestionType } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const baseQuestion =
      typeof body.baseQuestionId === "string" && body.baseQuestionId
        ? getQuestionById(body.baseQuestionId)
        : undefined;

    const result = await generateQuestions({
      provider: body.provider === "gemini" ? "gemini" : "openai",
      examType: normalizeExamType(body.examType),
      category: String(body.category || ""),
      difficulty: String(body.difficulty || "보통"),
      type: normalizeQuestionType(body.type),
      count: Math.min(10, Math.max(1, Number(body.count || 3))),
      instruction: String(body.instruction || ""),
      baseQuestion: baseQuestion || undefined,
    });

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "AI 문제 생성에 실패했습니다." },
      { status: 400 },
    );
  }
}
