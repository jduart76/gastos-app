from sqlmodel import SQLModel, create_engine, Session
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./gastos.db"
    CORS_ORIGINS: str = "http://localhost:5173"
    JWT_SECRET: str = "change_me"
    JWT_EXPIRE_MIN: int = 60 * 24 * 30  # 30 days

    class Config:
        env_file = ".env"

settings = Settings()

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(settings.DATABASE_URL, echo=False, connect_args=connect_args)

def get_session():
    with Session(engine) as session:
        yield session

def init_db():
    SQLModel.metadata.create_all(engine)
