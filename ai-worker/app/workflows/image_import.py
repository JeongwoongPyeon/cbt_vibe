import asyncio
import base64
import uuid
from typing import Any

from fastapi import UploadFile
from langchain_core.messages import HumanMessage, SystemMessage

from app.config import Settings
from app.providers.factory import create_structured_model
from app.prompts.question_generation import build_image_extraction_prompt
from app.schemas.question import (
    GenerateQuestionsResponse,
    ImportImagesRequest,
    QuestionBatch,
    QuestionDraft,
    RunMeta,
)
from app.validators.question_rules import validate_imported_question


MAX_IMAGES = 5
MAX_IMAGE_BYTES = 10 * 1024 * 1024
ALLOWED_MIME_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}


def _coerce_batch(value: Any) -> QuestionBatch:
    if isinstance(value, QuestionBatch):
        return value
    if isinstance(value, dict):
        return QuestionBatch.model_validate(value)
    content = getattr(value, "content", None)
    if isinstance(content, str):
        return QuestionBatch.model_validate_json(content)
    raise ValueError("사진에서 구조화된 문제 목록을 해석할 수 없습니다.")


async def _read_images(images: list[UploadFile]) -> list[tuple[str, str, bytes]]:
    if not images:
        raise ValueError("최소 1장의 사진을 업로드해야 합니다.")
    if len(images) > MAX_IMAGES:
        raise ValueError(f"한 번에 최대 {MAX_IMAGES}장까지 업로드할 수 있습니다.")

    result: list[tuple[str, str, bytes]] = []
    for image in images:
        mime_type = image.content_type or ""
        if mime_type not in ALLOWED_MIME_TYPES:
            raise ValueError("JPG, PNG, WEBP 이미지 파일만 업로드할 수 있습니다.")

        data = await image.read()
        if not data:
            raise ValueError("빈 이미지 파일은 처리할 수 없습니다.")
        if len(data) > MAX_IMAGE_BYTES:
            raise ValueError("이미지 한 장의 크기는 10MB 이하여야 합니다.")
        result.append((image.filename or "image", mime_type, data))

    return result


def _build_image_parts(
    provider: str,
    images: list[tuple[str, str, bytes]],
) -> list[dict[str, object]]:
    parts: list[dict[str, object]] = []
    for _filename, mime_type, data in images:
        encoded = base64.b64encode(data).decode("ascii")
        if provider == "gemini":
            parts.append({"type": "media", "data": encoded, "mime_type": mime_type})
        else:
            parts.append({"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{encoded}"}})
    return parts


async def import_image_questions(
    request: ImportImagesRequest,
    images: list[UploadFile],
    settings: Settings,
) -> GenerateQuestionsResponse:
    provider = request.provider or settings.default_provider
    if provider not in {"openai", "gemini"}:
        provider = "openai"

    uploaded = await _read_images(images)
    run_id = f"run_{uuid.uuid4().hex}"
    model, model_name = create_structured_model(provider, settings, vision=True)
    structured_model = (
        model.with_structured_output(QuestionBatch, method="json_schema")
        if provider == "openai"
        else model.with_structured_output(QuestionBatch)
    )
    system, prompt = build_image_extraction_prompt(
        request.exam_type,
        request.category,
        request.difficulty,
        request.type,
        request.max_questions,
        request.instruction,
    )
    messages = [
        SystemMessage(content=system),
        HumanMessage(content=[{"type": "text", "text": prompt}, *_build_image_parts(provider, uploaded)]),
    ]
    result = await asyncio.wait_for(
        structured_model.ainvoke(messages),
        timeout=settings.request_timeout_seconds,
    )
    batch = _coerce_batch(result)

    file_names = ", ".join(filename for filename, _mime, _data in uploaded)
    questions: list[QuestionDraft] = []
    errors: list[str] = []
    seen_stems: set[str] = set()

    for index, question in enumerate(batch.questions[: request.max_questions], start=1):
        question_errors = validate_imported_question(question, request)
        normalized_stem = "".join(question.stem.strip().lower().split())
        if normalized_stem and normalized_stem in seen_stems:
            question_errors.append("추출 결과 안에서 지문이 중복됩니다.")
        if normalized_stem:
            seen_stems.add(normalized_stem)

        answer_status = "confirmed" if question.answer.strip() and not question_errors else "uncertain"
        if not question.answer.strip():
            answer_status = "missing"
        normalized = question.model_copy(
            update={
                "source_type": "photo_ocr",
                "source_note": f"사진 변환: {file_names}"[:500],
                "source_asset_id": run_id,
                "answer_status": answer_status,
                "review_status": "pending",
                "validation_errors": question_errors,
            }
        )
        questions.append(normalized)
        errors.extend([f"{index}번 문제: {error}" for error in question_errors])

    if not questions:
        status = "failed"
    elif errors:
        status = "review_required"
    else:
        status = "preview_ready"

    return GenerateQuestionsResponse(
        runId=run_id,
        status=status,
        questions=questions,
        errors=errors,
        meta=RunMeta(
            provider=provider,
            model=model_name,
            promptVersion=settings.prompt_version,
            validationPassed=not errors,
        ),
    )
