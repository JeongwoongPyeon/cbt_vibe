from typing import Any

from app.config import Settings


def create_structured_model(
    provider: str,
    settings: Settings,
    *,
    vision: bool = False,
) -> tuple[Any, str]:
    if provider == "gemini":
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY가 설정되어 있지 않습니다.")
        from langchain_google_genai import ChatGoogleGenerativeAI

        model_name = settings.gemini_vision_model if vision else settings.gemini_model
        return (
            ChatGoogleGenerativeAI(
                model=model_name,
                temperature=0.4,
                google_api_key=settings.gemini_api_key,
                timeout=settings.request_timeout_seconds,
            ),
            model_name,
        )

    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY가 설정되어 있지 않습니다.")
    from langchain_openai import ChatOpenAI

    model_name = settings.openai_vision_model if vision else settings.openai_model
    return (
        ChatOpenAI(
            model=model_name,
            temperature=0.4,
            api_key=settings.openai_api_key,
            timeout=settings.request_timeout_seconds,
        ),
        model_name,
    )
