from pathlib import Path

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
    )

    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "neo4j"

    environment: str = "development"

    # Single-user system — owner of all data
    memoria_user_id: str = "meet"
    memoria_user_name: str = "Meet Kachhadiya"


settings = Settings()
