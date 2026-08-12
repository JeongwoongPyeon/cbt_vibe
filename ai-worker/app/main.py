from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from app.config import get_settings
from app.schemas.question import GenerateQuestionsRequest, GenerateQuestionsResponse, ImportImagesRequest
from app.workflows.image_import import import_image_questions
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


@app.post(
    "/v1/workflows/questions/import-images",
    response_model=GenerateQuestionsResponse,
)
async def import_image_workflow(
    provider: str | None = Form(default=None),
    exam_type: str = Form(alias="examType"),
    category: str = Form(default=""),
    difficulty: str = Form(default="보통"),
    question_type: str = Form(default="auto", alias="type"),
    max_questions: int = Form(default=10, alias="maxQuestions"),
    instruction: str = Form(default=""),
    images: list[UploadFile] = File(...),
) -> GenerateQuestionsResponse:
    try:
        request = ImportImagesRequest.model_validate(
            {
                "provider": provider,
                "examType": exam_type,
                "category": category,
                "difficulty": difficulty,
                "type": question_type,
                "maxQuestions": max_questions,
                "instruction": instruction,
            }
        )
        return await import_image_questions(request, images, get_settings())
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error) or "사진 문제 입력을 확인해 주세요.",
        ) from error
    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=str(error) or "사진 문제 변환에 실패했습니다.",
        ) from error
