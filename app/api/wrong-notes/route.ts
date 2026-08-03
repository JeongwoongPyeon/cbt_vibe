import { getAppState, updateWrongNote } from "@/lib/db";
import { normalizeTags } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const body = await request.json();
  const note = updateWrongNote({
    questionId: String(body.questionId || ""),
    reasonTags: normalizeTags(body.reasonTags),
    memo: String(body.memo || ""),
  });

  return Response.json({ note, state: getAppState() });
}

