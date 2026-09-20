from typing import Any

from app.config import Settings


def create_structured_model(
    provider: str,
    settings: Settings,
    *,
    vision: bool = False,
) -> tuple[Any, str]:
    if provider not in {"openai", "gemini", "anthropic"}:
        raise ValueError("지원하지 않는 AI 제공자입니다.")
    key = getattr(settings, f"{provider}_api_key").strip()
    if not key or key.startswith("your_") or key == "changeme":
        raise RuntimeError(f"{provider.upper()}_API_KEY가 설정되어 있지 않습니다.")
    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        model_name = settings.anthropic_vision_model if vision else settings.anthropic_model
        return (
            ChatAnthropic(
                model=model_name,
                api_key=key,
                max_tokens=16384,
                thinking={"type": "disabled"},
                timeout=settings.request_timeout_seconds,
            ),
            model_name,
        )
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
            api_key=settings.openai_api_key,
            timeout=settings.request_timeout_seconds,
        ),
        model_name,
    )
