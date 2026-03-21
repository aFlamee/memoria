from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "neo4j"

    environment: str = "development"

    # Single-user system — owner of all data
    memoria_user_id: str = "meet"
    memoria_user_name: str = "Meet Kachhadiya"


settings = Settings()
