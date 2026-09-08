import { examSubmissionSchema } from "../../lib/exam";
import { getAppState, submitExam } from "../../lib/db";

export async function POST(request: Request) {
  try {
    const parsed = examSubmissionSchema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        { error: "시험 답안 형식을 확인해 주세요. (1~100문항)" },
        { status: 400 },
      );
    const attempts = submitExam(parsed.data);
    return Response.json({
      attempts,
      state: getAppState(attempts[0].examType),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "시험 제출에 실패했습니다.",
      },
      { status: 400 },
    );
  }
}
