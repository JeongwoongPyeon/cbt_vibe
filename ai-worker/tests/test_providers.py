import asyncio
import base64
from io import BytesIO

import pytest
from fastapi import UploadFile
from starlette.datastructures import Headers

from app.config import Settings
from app.providers.factory import create_structured_model
from app.schemas.question import GenerateQuestionsRequest, ImportImagesRequest, QuestionBatch, QuestionDraft
from app.workflows import image_import, question_generation


@pytest.mark.parametrize("provider", ["openai", "gemini", "anthropic"])
def test_sdk_construction_and_schema_without_network(provider):
    settings = Settings()
    setattr(settings, f"{provider}_api_key", "test-not-a-real-key")
    model, name = create_structured_model(provider, settings)
    assert name == getattr(settings, f"{provider}_model")
    if provider == "openai":
        assert model.temperature is None
        model.with_structured_output(QuestionBatch, method="json_schema")
    else:
        model.with_structured_output(QuestionBatch)
    vision, vision_name = create_structured_model(provider, settings, vision=True)
    assert vision_name == getattr(settings, f"{provider}_vision_model")
    assert vision is not None


@pytest.mark.parametrize("key", ["", "your_anthropic_api_key_here", "changeme"])
def test_unconfigured_key_rejected(key):
    settings = Settings()
    settings.anthropic_api_key = key
    with pytest.raises(RuntimeError, match="ANTHROPIC_API_KEY"):
        create_structured_model("anthropic", settings)


def test_unknown_provider_is_not_silently_changed():
    with pytest.raises(ValueError):
        create_structured_model("unknown", Settings())


def test_anthropic_image_block_preserves_bytes():
    block = image_import._build_image_parts("anthropic", [("page.png", "image/png", b"image-bytes")])[0]
    assert block["type"] == "image"
    assert block["source"]["media_type"] == "image/png"
    assert base64.b64decode(block["source"]["data"]) == b"image-bytes"


@pytest.mark.parametrize("provider", ["openai", "gemini", "anthropic"])
def test_generation_and_photo_workflows_for_each_provider(provider, monkeypatch):
    calls = []

    class FakeRunnable:
        async def ainvoke(self, messages):
            calls.append(messages)
            return QuestionBatch(questions=[QuestionDraft(examType="ncs", type="multiple_choice_4", stem="테스트 문제", choices=["A", "B", "C", "D"], answer="A", explanation="A가 정답입니다.")])

    class FakeModel:
        def with_structured_output(self, schema, **kwargs):
            assert schema is QuestionBatch
            return FakeRunnable()

    def factory(selected, settings, **kwargs):
        assert selected == provider
        return FakeModel(), "mock-model"

    monkeypatch.setattr(question_generation, "create_structured_model", factory)
    monkeypatch.setattr(image_import, "create_structured_model", factory)
    generated = asyncio.run(question_generation.generate_questions(GenerateQuestionsRequest(provider=provider, examType="ncs", count=1), Settings()))
    assert generated.meta.provider == provider
    assert len(generated.questions) == 1
    file = UploadFile(file=BytesIO(b"fake-png"), filename="page.png", headers=Headers({"content-type": "image/png"}))
    extracted = asyncio.run(image_import.import_image_questions(ImportImagesRequest(provider=provider, examType="ncs"), [file], Settings()))
    assert extracted.meta.provider == provider
    assert len(extracted.questions) == 1
    assert len(calls) == 2
