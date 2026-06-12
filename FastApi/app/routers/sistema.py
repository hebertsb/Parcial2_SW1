"""
NexusFlow AI — Router de Sistema / Configuración en runtime
=============================================================
Permite consultar y alternar el modo de IA (local | api) sin
reiniciar el servicio — útil para demostrar que el motor de
DeepLearning/ML entrenado funciona de forma local (sin LLM
externo) y compararlo en vivo contra el modo con IA.

GET  /sistema/modo-ia  -> estado actual
POST /sistema/modo-ia  -> { "modo": "local" | "api" } cambia el modo
"""

import logging
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from ..config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sistema", tags=["Sistema"])


class ModoIARequest(BaseModel):
    modo: Literal["local", "api"]


def _estado_modo_ia() -> dict:
    motor_ia = "ia_openai" if settings.is_api_mode else "keyword_matching"
    return {
        "modo_ia": settings.ai_mode_efectivo,
        "is_api_mode": settings.is_api_mode,
        "openai_api_key_configurada": bool(settings.openai_api_key),
        "modelo": settings.openai_model,
        "motores": {
            "agente_clasificador": motor_ia,
            "reportes_interpretacion": motor_ia,
            "diagramador": motor_ia,
            "asistente": motor_ia,
            "analytics_recomendaciones": motor_ia,
            "voz_transcripcion": "whisper_api" if settings.is_api_mode else "simulacion_local",
        },
    }


@router.get("/modo-ia", summary="Consulta el modo de IA actual (local o api)")
async def obtener_modo_ia():
    return _estado_modo_ia()


@router.post("/modo-ia", summary="Cambia el modo de IA en caliente, sin reiniciar el servicio")
async def cambiar_modo_ia(request: ModoIARequest):
    settings.set_ai_mode_override(request.modo)
    logger.info(
        "Modo IA cambiado en caliente a '%s' (is_api_mode=%s)",
        settings.ai_mode_efectivo, settings.is_api_mode,
    )
    return _estado_modo_ia()
