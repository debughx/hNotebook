from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Must match Java API HS256 secret (at least 32 bytes as UTF-8 string).
    hnotebook_jwt_secret: str = "hnotebook-dev-jwt-secret-key-32b!"

    openai_base_url: str = "https://api.openai.com/v1"
    openai_api_key: str = ""
    embedding_model: str = "text-embedding-3-small"
    chat_model: str = "gpt-4o-mini"

    embedding_dimensions: int = 384
    chunk_size: int = 800
    chunk_overlap: int = 100
    retrieval_top_k: int = 5
    # SQLite database path (WAL). Legacy ./data/rag_store.json is imported once if DB is empty.
    rag_store_path: str = "./data/rag_store.db"


@lru_cache
def get_settings() -> Settings:
    return Settings()
