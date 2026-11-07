"""Environment-driven settings. Secrets are read here and never sent to the browser."""

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
# One .env at the repository root is shared with the frontend (Vite only exposes VITE_* keys to the browser).
ENV_FILE = BACKEND_DIR.parent / ".env"
load_dotenv(ENV_FILE)


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

    @property
    def openrouter_configured(self) -> bool:
        return bool(self.openrouter_api_key and self.openrouter_model)


def load_settings() -> Settings:
    return Settings(
        openrouter_api_key=os.getenv("OPENROUTER_API_KEY", "").strip(),
        openrouter_model=os.getenv("OPENROUTER_MODEL", "").strip(),
        openrouter_base_url=os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/"),
        openrouter_site_url=os.getenv("OPENROUTER_SITE_URL", "http://localhost:5173"),
        openrouter_app_name=os.getenv("OPENROUTER_APP_NAME", "root'd"),
        openfda_api_key=os.getenv("OPENFDA_API_KEY", "").strip(),
        database_path=os.getenv("DATABASE_PATH", "").strip() or str(BACKEND_DIR / "rootd.sqlite3"),
        cors_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()],
        max_upload_bytes=int(os.getenv("MAX_UPLOAD_BYTES", "").strip() or str(8 * 1024 * 1024)),
    )


settings = load_settings()
