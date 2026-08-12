from typing import Any

from app.config import Settings


def create_structured_model(provider: str, settings: Settings) -> tuple[Any, str]:
    if provider == "gemini":
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY가 설정되어 있지 않습니다.")
        from langchain_google_genai import ChatGoogleGenerativeAI

        return (
            ChatGoogleGenerativeAI(
                model=settings.gemini_model,
                temperature=0.4,
                google_api_key=settings.gemini_api_key,
            ),
            settings.gemini_model,
        )

    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY가 설정되어 있지 않습니다.")
    from langchain_openai import ChatOpenAI

    return (
        ChatOpenAI(
            model=settings.openai_model,
            temperature=0.4,
            api_key=settings.openai_api_key,
        ),
        settings.openai_model,
    )
