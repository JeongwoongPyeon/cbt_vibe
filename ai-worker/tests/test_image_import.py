import asyncio
from io import BytesIO

from fastapi import UploadFile
from starlette.datastructures import Headers

from app.config import Settings
from app.schemas.question import ImportImagesRequest, QuestionBatch, QuestionDraft
from app.workflows import image_import


def test_missing_answer_is_returned_for_review(monkeypatch) -> None:
    class FakeRunnable:
        async def ainvoke(self, _messages):
            return QuestionBatch(
                questions=[
                    QuestionDraft(
                        examType="ncs",
                        type="multiple_choice_4",
                        category="의사소통",
                        stem="사진에서 추출한 문제",
                        choices=["A", "B", "C", "D"],
                        answer="",
                        sourceType="photo_ocr",
                    )
                ]
            )

    class FakeModel:
        def with_structured_output(self, _schema, **_kwargs):
            return FakeRunnable()

    monkeypatch.setattr(
        image_import,
        "create_structured_model",
        lambda _provider, _settings, **_kwargs: (FakeModel(), "test-vision-model"),
    )

    image = UploadFile(
        file=BytesIO(b"fake-png"),
        filename="page-1.png",
        headers=Headers({"content-type": "image/png"}),
    )
    request = ImportImagesRequest.model_validate({"examType": "ncs", "maxQuestions": 3})
    response = asyncio.run(image_import.import_image_questions(request, [image], Settings()))

    assert response.status == "review_required"
    assert response.questions[0].answer_status == "missing"
    assert response.questions[0].source_type == "photo_ocr"
    assert response.questions[0].source_asset_id == response.run_id
    assert any("정답을 확인" in error for error in response.errors)
