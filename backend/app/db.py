import os
from functools import lru_cache
from typing import Generator, Optional

from pydantic_settings import BaseSettings
from sqlmodel import Session, SQLModel, create_engine


class Settings(BaseSettings):
    # If set, we use Neon/Postgres. If not, we fall back to local SQLite.
    DATABASE_URL: Optional[str] = None

    # other settings you might already be using
    JWT_SECRET: str = "CHANGE_ME"
    TOKEN_EXPIRE_MIN: int = 60 * 24 * 14  # 14 days
    CORS_ORIGINS: str = "http://localhost:5173"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    # Normalize Neon URL if it comes as postgres://
    if s.DATABASE_URL:
        s.DATABASE_URL = s.DATABASE_URL.replace("postgres://", "postgresql://")
    return s


settings = get_settings()


def _database_url() -> str:
    if settings.DATABASE_URL and settings.DATABASE_URL.strip():
        return settings.DATABASE_URL.strip()
    return "sqlite:///./gastos.db"


DATABASE_URL = _database_url()

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args=connect_args,
    pool_pre_ping=True,
)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
