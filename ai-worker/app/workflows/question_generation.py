import asyncio
import uuid
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.config import Settings
from app.providers.factory import create_structured_model
from app.prompts.question_generation import build_generation_messages
from app.schemas.question import (
    GenerateQuestionsRequest,
    GenerateQuestionsResponse,
    QuestionBatch,
    QuestionDraft,
    RunMeta,
)
from app.validators.question_rules import validate_question


def _coerce_batch(value: Any) -> QuestionBatch:
    if isinstance(value, QuestionBatch):
        return value
    if isinstance(value, dict):
        return QuestionBatch.model_validate(value)
    content = getattr(value, "content", None)
    if isinstance(content, str):
        return QuestionBatch.model_validate_json(content)
    raise ValueError("구조화된 문제 목록을 해석할 수 없습니다.")


async def generate_questions(
    request: GenerateQuestionsRequest,
    settings: Settings,
) -> GenerateQuestionsResponse:
    provider = request.provider or settings.default_provider
    if provider not in {"openai", "gemini", "anthropic"}:
        raise ValueError("지원하지 않는 AI 제공자입니다.")

    run_id = f"run_{uuid.uuid4().hex}"
    model, model_name = create_structured_model(provider, settings)
    structured_model = (
        model.with_structured_output(QuestionBatch, method="json_schema")
        if provider == "openai"
        else model.with_structured_output(QuestionBatch)
    )
    messages = [
        SystemMessage(content=content)
        if role == "system"
        else HumanMessage(content=content)
        for role, content in build_generation_messages(request)
    ]
    result = await asyncio.wait_for(
        structured_model.ainvoke(messages),
        timeout=settings.request_timeout_seconds,
    )
    batch = _coerce_batch(result)

    valid_questions: list[QuestionDraft] = []
    errors: list[str] = []
    expected_source = "ai_expanded" if request.base_question else "ai_generated"
    if len(batch.questions) != request.count:
        errors.append(f"요청한 {request.count}개 대신 {len(batch.questions)}개 문제가 반환되었습니다.")

    seen_stems: set[str] = set()

    for index, question in enumerate(batch.questions, start=1):
        question_errors = validate_question(question, request)
        normalized_stem = "".join(question.stem.strip().lower().split())
        if normalized_stem in seen_stems:
            question_errors.append("생성 결과 안에서 지문이 중복됩니다.")
        seen_stems.add(normalized_stem)

        if question_errors:
            errors.extend([f"{index}번 문제: {error}" for error in question_errors])
        else:
            valid_questions.append(
                question.model_copy(
                    update={
                        "source_type": expected_source,
                        "part": request.part,
                        "unit": request.unit,
                        "topic": request.topic,
                    }
                )
            )

    if len(valid_questions) == 0:
        status = "failed"
    else:
        status = "preview_ready"

    return GenerateQuestionsResponse(
        runId=run_id,
        status=status,
        questions=valid_questions,
        errors=errors,
        meta=RunMeta(
            provider=provider,
            model=model_name,
            promptVersion=settings.prompt_version,
            validationPassed=not errors,
        ),
    )
