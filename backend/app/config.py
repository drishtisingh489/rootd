"""Environment-driven settings. Secrets are read here and never sent to the browser or logged."""

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent

# Env files, most specific first. Paths come from this file's location, so the working directory doesn't matter.
# python-dotenv never overrides a variable that is already set, so the precedence is:
#   real environment variables  >  backend/.env (optional)  >  .env at the repo root (shared with the frontend)
ENV_FILES = (BACKEND_DIR / ".env", REPO_DIR / ".env")
LOADED_ENV_FILES = tuple(str(p) for p in ENV_FILES if p.is_file())
for _path in LOADED_ENV_FILES:
    load_dotenv(_path)

PLACEHOLDER_PREFIXES = ("replace_with", "your_", "your-", "<")
PLACEHOLDER_VALUES = {"changeme", "change_me", "todo", "xxx", "none", "null"}


def is_placeholder(value: str) -> bool:
    v = value.strip().lower()
    return v.startswith(PLACEHOLDER_PREFIXES) or v in PLACEHOLDER_VALUES


@dataclass(frozen=True)
class Settings:
    openrouter_api_key: str
    openrouter_model: str
    openrouter_base_url: str
    openrouter_site_url: str
    openrouter_app_name: str
    openfda_api_key: str
    database_path: str
    cors_origins: list[str]
    max_upload_bytes: int
    env_files: tuple[str, ...] = field(default=())

    @property
    def openrouter_problems(self) -> list[str]:
        """Which OpenRouter variables are unusable, by name only (never their values)."""
        problems = []
        for name, value in (("OPENROUTER_API_KEY", self.openrouter_api_key),
                            ("OPENROUTER_MODEL", self.openrouter_model)):
            if not value:
                problems.append(f"{name} is not set")
            elif is_placeholder(value):
                problems.append(f"{name} still has a placeholder value")
        return problems

    @property
    def openrouter_configured(self) -> bool:
        return not self.openrouter_problems


def load_settings() -> Settings:
    return Settings(
        openrouter_api_key=os.getenv("OPENROUTER_API_KEY", "").strip().strip("\"'"),
        openrouter_model=os.getenv("OPENROUTER_MODEL", "").strip().strip("\"'"),
        openrouter_base_url=(os.getenv("OPENROUTER_BASE_URL", "").strip() or "https://openrouter.ai/api/v1").rstrip("/"),
        openrouter_site_url=os.getenv("OPENROUTER_SITE_URL", "").strip() or "http://localhost:5173",
        openrouter_app_name=os.getenv("OPENROUTER_APP_NAME", "").strip() or "root'd",
        openfda_api_key=os.getenv("OPENFDA_API_KEY", "").strip(),
        database_path=os.getenv("DATABASE_PATH", "").strip() or str(BACKEND_DIR / "rootd.sqlite3"),
        cors_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()],
        max_upload_bytes=int(os.getenv("MAX_UPLOAD_BYTES", "").strip() or str(8 * 1024 * 1024)),
        env_files=LOADED_ENV_FILES,
    )


settings = load_settings()
