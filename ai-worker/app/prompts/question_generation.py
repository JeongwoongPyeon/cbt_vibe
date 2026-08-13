from app.schemas.question import GenerateQuestionsRequest


EXAM_PROFILES = {
    "ncs": "직업기초능력 중심으로 상황을 해석하고 적용하는 문제를 만든다.",
    "computer_general": "운영체제, 네트워크, 데이터베이스, 소프트웨어, 컴퓨터 구조의 기초를 다룬다.",
    "information_security": "기밀성, 무결성, 가용성, 인증, 접근통제, 암호화, 네트워크 보안을 다룬다.",
}


def build_generation_messages(request: GenerateQuestionsRequest) -> list[tuple[str, str]]:
    profile = EXAM_PROFILES[request.exam_type]
    base_context = ""
    if request.base_question:
        base = request.base_question
        base_context = f"""
기준 문제를 참고하되 문장과 보기는 새롭게 구성한다.
- 기준 지문: {str(base.get('stem') or base.get('question') or '')[:2000]}
- 기준 보기: {str(base.get('choices') or '')[:1500]}
- 기준 정답: {str(base.get('answer') or '')[:500]}
- 기준 해설: {str(base.get('explanation') or '')[:1000]}
"""

    system = """너는 한국어 CBT 출제 도우미다. 요청된 형식에 맞는 문제만 만든다.
사실을 임의로 꾸미지 말고, 불확실한 내용은 사용자가 검토할 수 있도록 보수적으로 작성한다.
응답은 QuestionBatch JSON 스키마에 맞춰 반환한다. 마크다운이나 설명 문장을 추가하지 않는다."""
    human = f"""다음 조건으로 문제 {request.count}개를 생성한다.

- 시험 종류: {request.exam_type}
- 시험 범위: {profile}
- 대단원: {request.part or '지정되지 않음'}
- 단원: {request.unit or '사용자 지정 없음'}
- 세부 기준: {request.topic or '사용자 지정 없음'}
- 문제 유형: {request.type}
- 카테고리: {request.category or '적절한 세부 카테고리'}
- 난이도: {request.difficulty or '보통'}
- 추가 요청: {request.instruction or '없음'}
{base_context}

작성 규칙:
- multiple_choice_4는 보기 4개, multiple_choice_5는 보기 5개를 정확히 만든다.
- short_answer는 choices를 빈 배열로 만든다.
- 객관식 answer는 보기 문장 또는 1부터 시작하는 보기 번호로 작성한다.
- 모든 문제에 간결한 해설을 포함한다.
- part, unit, topic에는 요청된 기준값을 그대로 기록한다.
- sourceType은 기준 문제가 있으면 ai_expanded, 없으면 ai_generated로 작성한다.
"""
    return [("system", system), ("human", human)]


def build_image_extraction_prompt(
    exam_type: str,
    category: str,
    part: str,
    unit: str,
    topic: str,
    difficulty: str,
    question_type: str,
    max_questions: int,
    instruction: str,
) -> tuple[str, str]:
    requested_type = question_type if question_type != "auto" else "사진에 보이는 형식에 따라 자동 판별"
    system = """너는 문제집 사진을 CBT 문제 데이터로 옮기는 추출 도우미다.
사진에 실제로 보이는 텍스트만 옮기고, 잘 보이지 않거나 사진에 없는 내용은 추측하지 않는다.
응답은 QuestionBatch JSON 스키마에 맞춘다. 문제마다 sourceType은 photo_ocr로 설정한다.
정답이 사진에 없거나 확실하지 않으면 answer를 빈 문자열 또는 추출값으로 두고 answerStatus를 missing 또는 uncertain으로 설정한다.
extractionConfidence는 0부터 1 사이의 보수적인 값으로 작성한다."""
    human = f"""업로드된 이미지에서 CBT 문제를 최대 {max_questions}개 추출한다.

- 시험 종류: {exam_type}
- 대단원: {part or '지정되지 않음'}
- 단원: {unit or '사용자 지정 없음'}
- 세부 기준: {topic or '사용자 지정 없음'}
- 카테고리: {category or '사진 내용을 바탕으로 분류'}
- 난이도: {difficulty or '보통'}
- 문제 유형: {requested_type}
- 추가 요청: {instruction or '없음'}

규칙:
- 4지선다형은 보기 4개, 5지선다형은 보기 5개를 유지한다.
- 단답형은 choices를 빈 배열로 둔다.
- 사진 순서에 맞춰 sourcePage를 1부터 기록한다.
- 원본에 없는 해설이나 정답을 새로 만들지 않는다.
- 문제 경계가 불명확하면 validationErrors에 확인 내용을 기록한다.
"""
    return system, human
