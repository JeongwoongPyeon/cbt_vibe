import { getAppState } from "@/lib/db";
import { normalizeExamType } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const examType = normalizeExamType(new URL(request.url).searchParams.get("examType"));
  return Response.json(getAppState(examType));
}
