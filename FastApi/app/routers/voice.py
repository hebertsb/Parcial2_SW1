"""
NexusFlow AI - Router de Transcripción de Voz (CU-18)
=====================================================
Endpoint para transcribir audio a texto y extraer
entidades para rellenar formularios automáticamente.
"""

import logging

from fastapi import APIRouter, HTTPException, status

from ..models import VoiceRequest, VoiceResponse
from ..services.voice_service import VoiceService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voz", tags=["IA - Voz"])

# Instancia del servicio de voz (Singleton a nivel de módulo)
_voice_service = VoiceService()


@router.post(
    "/transcribir",
    response_model=VoiceResponse,
    summary="Transcribir audio a texto",
    description=(
        "Recibe audio codificado en Base64, lo transcribe a texto usando "
        "OpenAI Whisper, y extrae entidades relevantes (montos, fechas, nombres) "
        "para rellenar formularios automáticamente."
    ),
    responses={
        200: {"description": "Audio transcrito exitosamente"},
        422: {"description": "Error de validación: formato de audio no soportado"},
        500: {"description": "Error interno al transcribir"},
    },
)
async def transcribir(request: VoiceRequest) -> VoiceResponse:
    """
    Transcribe audio del funcionario y extrae datos para el formulario.

    **Flujo:**
    1. Recibe audio en Base64 desde el frontend/móvil.
    2. Transcribe a texto usando Whisper API.
    3. Extrae entidades (montos, fechas, nombres, CI).
    4. Devuelve texto + entidades para rellenar el formulario.

    **Formatos soportados:** wav, mp3, webm, ogg, m4a, flac
    """
    try:
        logger.info(
            "Solicitud de transcripción - Trámite: %s, Campo: %s, Formato: %s",
            request.tramite_id,
            request.campo_id,
            request.formato,
        )

        # Transcribir audio a texto
        texto = await _voice_service.transcribir(request.audio_base64, request.formato)

        # Extraer entidades del texto transcrito
        entidades = _voice_service.extraer_datos_del_texto(texto)

        logger.info(
            "Transcripción completada - Texto: '%s', Entidades: %d",
            texto[:60],
            len(entidades),
        )

        return VoiceResponse(
            texto=texto,
            campoId=request.campo_id,
            tramiteId=request.tramite_id,
            entidades=entidades if entidades else None,
        )

    except Exception as error:
        logger.exception("Error al transcribir audio")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al transcribir audio: {error}",
        )
