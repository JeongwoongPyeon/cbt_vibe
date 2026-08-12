from functools import lru_cache
from pathlib import Path
import os

from dotenv import load_dotenv


REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPO_ROOT / ".env")


class Settings:
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    default_provider: str = os.getenv("AI_DEFAULT_PROVIDER", "openai")
    prompt_version: str = os.getenv("AI_PROMPT_VERSION", "question-v1")
    request_timeout_seconds: float = float(os.getenv("AI_WORKER_REQUEST_TIMEOUT", "90"))


@lru_cache
def get_settings() -> Settings:
    return Settings()
