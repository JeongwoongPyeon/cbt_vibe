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

    const workerUrl = (process.env.AI_WORKER_URL || "http://127.0.0.1:8001").replace(/\/$/, "");
    const workerResponse = await fetch(`${workerUrl}/v1/workflows/questions/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: body.provider === "gemini" ? "gemini" : "openai",
        examType: normalizeExamType(body.examType),
        category: String(body.category || ""),
        difficulty: String(body.difficulty || "보통"),
        type: normalizeQuestionType(body.type),
        count: Math.min(10, Math.max(1, Number(body.count || 3))),
        instruction: String(body.instruction || ""),
        baseQuestion: baseQuestion || undefined,
      }),
      signal: AbortSignal.timeout(Number(process.env.AI_WORKER_TIMEOUT_MS || 90000)),
    });

    const payload = await workerResponse.json().catch(() => null);
    if (!workerResponse.ok) {
      const detail = typeof payload?.detail === "string" ? payload.detail : "AI Worker 요청에 실패했습니다.";
      throw new Error(detail);
    }

    return Response.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 문제 생성에 실패했습니다.";
    return Response.json(
      {
        error: message.includes("fetch failed") || message.includes("ECONNREFUSED")
          ? "AI Worker가 실행 중인지 확인해 주세요. (127.0.0.1:8001)"
          : message,
      },
      { status: 400 },
    );
  }
}
