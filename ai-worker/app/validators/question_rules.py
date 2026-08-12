from app.schemas.question import GenerateQuestionsRequest, QuestionDraft


def expected_choice_count(question_type: str) -> int:
    return {
        "multiple_choice_4": 4,
        "multiple_choice_5": 5,
        "short_answer": 0,
    }.get(question_type, 0)


def normalize_for_compare(value: str) -> str:
    return "".join(value.strip().lower().split())


def validate_question(question: QuestionDraft, request: GenerateQuestionsRequest) -> list[str]:
    errors: list[str] = []
    expected_count = expected_choice_count(question.type)

    if question.exam_type != request.exam_type:
        errors.append("시험 종류가 요청과 일치하지 않습니다.")

    if question.type != request.type:
        errors.append("문제 유형이 요청과 일치하지 않습니다.")

    if not question.stem.strip():
        errors.append("문제 지문이 비어 있습니다.")

    if question.type == "short_answer":
        if question.choices:
            errors.append("단답형 문제에는 보기가 없어야 합니다.")
    elif len(question.choices) != expected_count:
        errors.append(f"{expected_count}개의 보기가 필요합니다.")
    elif len({normalize_for_compare(choice) for choice in question.choices}) != expected_count:
        errors.append("보기에는 중복 항목이 없어야 합니다.")

    if question.type != "short_answer":
        normalized_answer = normalize_for_compare(question.answer)
        numeric_answer = question.answer.strip()
        valid_numeric = numeric_answer.isdigit() and 1 <= int(numeric_answer) <= expected_count
        valid_text = normalized_answer in {
            normalize_for_compare(choice) for choice in question.choices
        }
        if not valid_numeric and not valid_text:
            errors.append("정답이 보기 또는 유효한 보기 번호와 일치하지 않습니다.")

    return errors
