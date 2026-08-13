from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


ExamType = Literal["ncs", "computer_general", "information_security"]
QuestionType = Literal["multiple_choice_4", "multiple_choice_5", "short_answer"]
ImportQuestionType = Literal["auto", "multiple_choice_4", "multiple_choice_5", "short_answer"]
Provider = Literal["openai", "gemini"]


class QuestionDraft(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    exam_type: ExamType = Field(alias="examType")
    type: QuestionType
    category: Annotated[str, Field(max_length=120)] = "미분류"
    part: Annotated[str, Field(max_length=160)] = ""
    unit: Annotated[str, Field(max_length=160)] = ""
    topic: Annotated[str, Field(max_length=160)] = ""
    tags: list[str] = Field(default_factory=list, max_length=12)
    difficulty: Annotated[str, Field(min_length=1, max_length=40)] = "보통"
    stem: Annotated[str, Field(max_length=4000)] = ""
    choices: list[str] = Field(default_factory=list, max_length=5)
    answer: Annotated[str, Field(max_length=1000)] = ""
    acceptable_answers: list[str] = Field(default_factory=list, alias="acceptableAnswers", max_length=20)
    explanation: Annotated[str, Field(max_length=4000)] = ""
    source_type: Literal["ai_generated", "ai_expanded", "photo_ocr"] = Field(default="ai_generated", alias="sourceType")
    source_note: Annotated[str, Field(max_length=500)] = Field(default="AI 생성", alias="sourceNote")
    source_asset_id: str | None = Field(default=None, alias="sourceAssetId")
    source_page: int | None = Field(default=None, ge=1, alias="sourcePage")
    extraction_confidence: float | None = Field(default=None, ge=0, le=1, alias="extractionConfidence")
    answer_status: Literal["confirmed", "uncertain", "missing"] = Field(default="confirmed", alias="answerStatus")
    review_status: Literal["pending", "approved", "rejected"] = Field(default="pending", alias="reviewStatus")
    validation_errors: list[str] = Field(default_factory=list, alias="validationErrors")

    @field_validator("tags", "choices", "acceptable_answers", mode="before")
    @classmethod
    def normalize_list(cls, value: object) -> list[str]:
        if value is None:
            return []
        if isinstance(value, str):
            return [item.strip() for item in value.replace("|", ",").split(",") if item.strip()]
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        return []


class QuestionBatch(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    questions: list[QuestionDraft] = Field(default_factory=list, max_length=10)


class GenerateQuestionsRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    provider: Provider | None = None
    exam_type: ExamType = Field(alias="examType")
    category: Annotated[str, Field(max_length=120)] = ""
    part: Annotated[str, Field(max_length=160)] = ""
    unit: Annotated[str, Field(max_length=160)] = ""
    topic: Annotated[str, Field(max_length=160)] = ""
    difficulty: Annotated[str, Field(max_length=40)] = "보통"
    type: QuestionType = "multiple_choice_4"
    count: Annotated[int, Field(ge=1, le=10)] = 3
    instruction: Annotated[str, Field(max_length=2000)] = ""
    base_question: dict[str, object] | None = Field(default=None, alias="baseQuestion")


class ImportImagesRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    provider: Provider | None = None
    exam_type: ExamType = Field(alias="examType")
    category: Annotated[str, Field(max_length=120)] = ""
    part: Annotated[str, Field(max_length=160)] = ""
    unit: Annotated[str, Field(max_length=160)] = ""
    topic: Annotated[str, Field(max_length=160)] = ""
    difficulty: Annotated[str, Field(max_length=40)] = "보통"
    type: ImportQuestionType = "auto"
    max_questions: Annotated[int, Field(ge=1, le=10)] = Field(default=10, alias="maxQuestions")
    instruction: Annotated[str, Field(max_length=2000)] = ""


class RunMeta(BaseModel):
    provider: Provider
    model: str
    prompt_version: str = Field(alias="promptVersion")
    validation_passed: bool = Field(alias="validationPassed")


class GenerateQuestionsResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    run_id: str = Field(alias="runId")
    status: Literal["preview_ready", "review_required", "failed"]
    questions: list[QuestionDraft] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    meta: RunMeta
