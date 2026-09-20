from functools import lru_cache
from pathlib import Path
import os

from dotenv import load_dotenv


REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPO_ROOT / ".env")


class Settings:
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-5.4-mini")
    openai_vision_model: str = os.getenv("OPENAI_VISION_MODEL", openai_model)
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    gemini_vision_model: str = os.getenv("GEMINI_VISION_MODEL", gemini_model)
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    anthropic_model: str = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5")
    anthropic_vision_model: str = os.getenv("ANTHROPIC_VISION_MODEL", anthropic_model)
    default_provider: str = os.getenv("AI_DEFAULT_PROVIDER", "openai")
    prompt_version: str = os.getenv("AI_PROMPT_VERSION", "question-v1")
    request_timeout_seconds: float = float(os.getenv("AI_WORKER_REQUEST_TIMEOUT", "90"))


@lru_cache
def get_settings() -> Settings:
    return Settings()
