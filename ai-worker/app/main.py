from fastapi import FastAPI, HTTPException

from app.config import get_settings
from app.schemas.question import GenerateQuestionsRequest, GenerateQuestionsResponse
from app.workflows.question_generation import generate_questions


app = FastAPI(title="CBT AI Worker", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "cbt-ai-worker"}


@app.post(
    "/v1/workflows/questions/generate",
    response_model=GenerateQuestionsResponse,
)
async def generate_question_workflow(
    request: GenerateQuestionsRequest,
) -> GenerateQuestionsResponse:
    try:
        return await generate_questions(request, get_settings())
    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=str(error) or "AI 문제 생성에 실패했습니다.",
        ) from error
