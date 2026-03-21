from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

CONFIG_PATH = Path(__file__).resolve()
BACKEND_ROOT = CONFIG_PATH.parents[1]
ENV_FILES = []

if len(CONFIG_PATH.parents) > 3:
    ENV_FILES.append(CONFIG_PATH.parents[3] / ".env")

ENV_FILES.append(BACKEND_ROOT / ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=tuple(ENV_FILES),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    convex_site_url: str = Field(
        default="http://127.0.0.1:3210",
        validation_alias=AliasChoices("CONVEX_SITE_URL", "PUBLIC_CONVEX_SITE_URL"),
    )
    memoria_convex_ingest_secret: str = "memoria-local-ingest-secret"

    environment: str = "development"

    # Single-user system — owner of all data
    memoria_user_id: str = "meet"
    memoria_user_name: str = "Meet Kachhadiya"


settings = Settings()
