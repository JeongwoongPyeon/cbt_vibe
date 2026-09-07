import { getAppState, recordAttempt } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const attempt = recordAttempt({
      questionId: String(body.questionId || ""),
      selectedAnswer: String(body.selectedAnswer || ""),
      elapsedSeconds: Number(body.elapsedSeconds || 0),
      mode: body.mode === "review" || body.mode === "exam" ? body.mode : "practice",
    });

    return Response.json({ attempt, state: getAppState(attempt.examType) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "풀이 기록 저장에 실패했습니다." },
      { status: 400 },
    );
  }
}
