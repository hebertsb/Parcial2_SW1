"""
NexusFlow AI - Módulo de Configuración
=======================================
Gestiona todas las variables de entorno y configuración
del microservicio de IA usando pydantic-settings.
"""

import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings

# Archivo compartido (mismo filesystem entre workers de uvicorn) usado para
# alternar el modo de IA en caliente vía /sistema/modo-ia sin reiniciar el
# servicio. Si no existe, se usa el valor de AI_MODE del entorno.
_AI_MODE_OVERRIDE_FILE = Path(
    os.environ.get("AI_MODE_OVERRIDE_FILE", "/tmp/nexusflow_ai_mode_override")
)


class Settings(BaseSettings):
    """
    Configuración centralizada del servicio de IA.
    Los valores se cargan desde variables de entorno o archivo .env
    """

    # ---- OpenAI API / Groq compatible ----
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o-mini"
    whisper_model: str = "whisper-1"
    openai_base_url: Optional[str] = None  # Groq: https://api.groq.com/openai/v1

    # ---- Servidor ----
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False

    # ---- Spring Boot Backend ----
    spring_boot_url: str = "http://localhost:9090"

    # ---- MongoDB (misma instancia que Spring Boot) ----
    mongodb_uri: str = "mongodb://127.0.0.1:27017"
    mongodb_database: str = "nexusflow_oficial"

    # ---- CORS ----
    cors_origins: str = "*"

    # ---- Modo de operación ----
    # "api" = Usa OpenAI API (requiere OPENAI_API_KEY)
    # "local" = Usa plantillas locales sin API externa
    ai_mode: str = "api"

    # ---- Rutas de modelos ML ----
    ml_models_dir: str = "ml_models"

    # ---- MinIO / S3-compatible (Segundo Parcial) ----
    s3_endpoint_url: Optional[str] = None          # None = AWS real, "http://minio:9000" = MinIO
    s3_access_key: Optional[str] = None
    s3_secret_key: Optional[str] = None
    s3_bucket_name: str = "nexusflow-documentos"
    s3_region: str = "us-east-1"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @property
    def cors_origins_list(self) -> list[str]:
        """Convierte la cadena de orígenes CORS a lista."""
        if self.cors_origins == "*":
            return ["*"]
        return [origin.strip() for origin in self.cors_origins.split(",")]

    @property
    def ai_mode_efectivo(self) -> str:
        """Modo de IA actual: respeta el override en caliente (si existe), sino AI_MODE del entorno."""
        try:
            valor = _AI_MODE_OVERRIDE_FILE.read_text(encoding="utf-8").strip()
            if valor in ("local", "api"):
                return valor
        except FileNotFoundError:
            pass
        return self.ai_mode

    @property
    def is_api_mode(self) -> bool:
        """Verifica si está configurado para usar APIs externas."""
        return self.ai_mode_efectivo == "api" and bool(self.openai_api_key)

    def set_ai_mode_override(self, modo: str) -> None:
        """Cambia el modo de IA en caliente (compartido entre workers vía archivo)."""
        _AI_MODE_OVERRIDE_FILE.write_text(modo, encoding="utf-8")

    def clear_ai_mode_override(self) -> None:
        """Elimina el override en caliente, volviendo al AI_MODE del entorno."""
        _AI_MODE_OVERRIDE_FILE.unlink(missing_ok=True)


# Instancia global de configuración (Singleton)
settings = Settings()
