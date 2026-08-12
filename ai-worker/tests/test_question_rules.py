import asyncio

from app.schemas.question import GenerateQuestionsRequest, QuestionDraft
from app.validators.question_rules import validate_question


def make_question(**updates: object) -> QuestionDraft:
    values: dict[str, object] = {
        "examType": "ncs",
        "type": "multiple_choice_4",
        "category": "의사소통",
        "tags": ["독해"],
        "difficulty": "기초",
        "stem": "다음 중 알맞은 것은?",
        "choices": ["A", "B", "C", "D"],
        "answer": "A",
        "acceptableAnswers": [],
        "explanation": "설명",
        "sourceType": "ai_generated",
        "sourceNote": "AI 생성",
    }
    values.update(updates)
    return QuestionDraft.model_validate(values)


def make_request(**updates: object) -> GenerateQuestionsRequest:
    values: dict[str, object] = {
        "examType": "ncs",
        "type": "multiple_choice_4",
        "category": "의사소통",
        "difficulty": "기초",
        "count": 1,
    }
    values.update(updates)
    return GenerateQuestionsRequest.model_validate(values)


def test_valid_multiple_choice_question_has_no_errors() -> None:
    assert validate_question(make_question(), make_request()) == []


def test_multiple_choice_requires_exact_choice_count() -> None:
    errors = validate_question(make_question(choices=["A", "B"]), make_request())
    assert "4개의 보기가 필요합니다." in errors


def test_short_answer_rejects_choices() -> None:
    question = make_question(
        type="short_answer",
        choices=["A"],
        answer="정답",
    )
    request = make_request(type="short_answer")
    assert "단답형 문제에는 보기가 없어야 합니다." in validate_question(question, request)


def test_answer_must_match_choice_or_number() -> None:
    errors = validate_question(make_question(answer="없는 정답"), make_request())
    assert "정답이 보기 또는 유효한 보기 번호와 일치하지 않습니다." in errors


def test_workflow_rejects_provider_output_with_wrong_type(monkeypatch) -> None:
    from app.config import Settings
    from app.schemas.question import QuestionBatch
    from app.workflows import question_generation

    class FakeRunnable:
        async def ainvoke(self, _messages):
            return QuestionBatch(
                questions=[
                    make_question(
                        type="multiple_choice_5",
                        choices=["A", "B", "C", "D", "E"],
                    )
                ]
            )

    class FakeModel:
        def with_structured_output(self, _schema, **_kwargs):
            return FakeRunnable()

    monkeypatch.setattr(
        question_generation,
        "create_structured_model",
        lambda _provider, _settings: (FakeModel(), "test-model"),
    )

    response = asyncio.run(
        question_generation.generate_questions(make_request(), Settings())
    )

    assert response.status == "failed"
    assert response.questions == []
    assert any("문제 유형이 요청과 일치하지 않습니다." in error for error in response.errors)
