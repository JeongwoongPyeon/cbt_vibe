import { normalizeExamType } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const incoming = await request.formData();
    const images = incoming.getAll("images").filter((value): value is File => value instanceof File);

    if (images.length === 0) {
      return Response.json({ error: "문제집 사진을 한 장 이상 선택해 주세요." }, { status: 400 });
    }

    const form = new FormData();
    for (const image of images) {
      form.append("images", image, image.name);
    }

    form.set("provider", incoming.get("provider") === "gemini" ? "gemini" : "openai");
    form.set("examType", normalizeExamType(incoming.get("examType")));
    form.set("category", String(incoming.get("category") || ""));
    form.set("difficulty", String(incoming.get("difficulty") || "보통"));
    form.set("type", "auto");
    form.set("maxQuestions", String(Math.min(10, Math.max(1, Number(incoming.get("maxQuestions") || 10)))));
    form.set("instruction", String(incoming.get("instruction") || ""));

    const workerUrl = (process.env.AI_WORKER_URL || "http://127.0.0.1:8001").replace(/\/$/, "");
    const workerResponse = await fetch(`${workerUrl}/v1/workflows/questions/import-images`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(Number(process.env.AI_WORKER_TIMEOUT_MS || 90000)),
    });

    const payload = await workerResponse.json().catch(() => null);
    if (!workerResponse.ok) {
      const detail = typeof payload?.detail === "string" ? payload.detail : "AI Worker 요청에 실패했습니다.";
      throw new Error(detail);
    }

    return Response.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "사진 문제 변환에 실패했습니다.";
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
