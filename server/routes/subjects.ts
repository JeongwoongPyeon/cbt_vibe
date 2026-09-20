import { deleteSubject, getAppState, restoreSubject } from "@/lib/db";
import { EXAM_TYPES, isExamType } from "@/lib/types";

export async function mutateSubject(request: Request) {
  const body = await request.json();
  if (!body || !isExamType(body.id))
    return Response.json(
      { error: "유효한 과목을 선택해 주세요." },
      { status: 400 },
    );
  try {
    if (request.method === "DELETE") {
      const label = EXAM_TYPES.find((subject) => subject.id === body.id)!.label;
      if (
        body.confirmation !== label ||
        ![
          body.expected?.questions,
          body.expected?.attempts,
          body.expected?.wrongNotes,
        ].every((value) => Number.isSafeInteger(value) && value >= 0)
      ) {
        return Response.json(
          { error: "과목 이름과 삭제 범위를 확인해 주세요." },
          { status: 400 },
        );
      }
      deleteSubject(body.id, body.expected);
    } else {
      restoreSubject(body.id);
    }
    return Response.json({ state: getAppState(body.id) });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "과목 변경에 실패했습니다.",
      },
      { status: 409 },
    );
  }
}
