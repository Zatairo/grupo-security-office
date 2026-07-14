"""Configuración centralizada cargada desde .env"""
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional
import os


class Settings(BaseSettings):
    # Discord
    discord_bot_token: str
    discord_guild_id: str
    channel_sala_operaciones: Optional[str] = None
    channel_arquitectura: Optional[str] = None
    channel_dev: Optional[str] = None
    channel_contenido: Optional[str] = None
    channel_qa: Optional[str] = None

    # OpenRouter
    openrouter_api_key: str
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    model_mistral: str = "mistralai/mistral-small-2603"
    model_qwen: str = "qwen/qwen3.6-35b-a3b"
    model_auto_primary: str = "mistralai/mistral-small-2603"
    model_auto_fallback: str = "qwen/qwen3.6-35b-a3b"

    # Memoria
    memory_db_path: str = "data/memory.db"
    memory_max_context_tokens: int = 4096
    memory_retention_days: int = 90

    # Seguridad
    max_delegation_depth: int = 3
    max_tokens_per_request: int = 2048
    zdr_enabled: bool = True
    zdr_log_sanitization: bool = True

    # Entorno
    env: str = "development"
    log_level: str = "INFO"
    log_file: str = "data/office.log"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Singleton global
settings = Settings()
