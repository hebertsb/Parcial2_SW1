"""
NexusFlow AI - Router del Asistente Contextual
===============================================
Endpoint para el agente de IA que guía a los usuarios
según su rol y contexto actual en la aplicación.
"""

import logging

from fastapi import APIRouter, HTTPException, status

from ..models import (
    AssistantRequest,
    AssistantResponse,
    AsistenteColabRequest,
    AsistenteColabResponse,
)
from ..services.assistant_service import AssistantService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/asistente", tags=["IA - Asistente"])

# Instancia del servicio de asistente (Singleton a nivel de módulo)
_assistant_service = AssistantService()


@router.post(
    "/ayuda",
    response_model=AssistantResponse,
    summary="Obtener ayuda contextual del asistente de IA",
    description=(
        "El asistente NexusBot analiza el rol del usuario y su contexto "
        "actual para brindar ayuda personalizada sobre cómo usar la aplicación."
    ),
    responses={
        200: {"description": "Respuesta del asistente generada"},
        500: {"description": "Error interno del asistente"},
    },
)
async def obtener_ayuda(request: AssistantRequest) -> AssistantResponse:
    """
    Asistente de IA contextual que guía al usuario.

    **Roles soportados:**
    - `administrador`: Gestión de políticas, usuarios y monitoreo.
    - `disenador`: Creación y edición de diagramas de actividad.
    - `funcionario`: Ejecución de tareas y llenado de formularios.
    - `cliente`: Consulta de estado de trámites.

    **Ejemplo:**
    ```json
    {
      "mensaje": "¿Cómo creo un diagrama?",
      "rolUsuario": "disenador",
      "contextoActual": "editor-diagrama"
    }
    ```
    """
    try:
        logger.info(
            "Solicitud de ayuda - Rol: %s, Contexto: %s, Mensaje: '%s'",
            request.rol_usuario,
            request.contexto_actual,
            request.mensaje[:60],
        )

        resultado = await _assistant_service.obtener_ayuda(
            mensaje=request.mensaje,
            rol_usuario=request.rol_usuario,
            contexto_actual=request.contexto_actual,
        )

        return AssistantResponse(
            respuesta=resultado["respuesta"],
            sugerencias=resultado.get("sugerencias", []),
        )

    except Exception as error:
        logger.exception("Error en el asistente de IA")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error del asistente: {error}",
        )


@router.post(
    "/colaborativo",
    response_model=AsistenteColabResponse,
    summary="Asistente de revisión en el editor colaborativo",
    description=(
        "Analiza el trámite (BD), la política/flujo y el documento en revisión "
        "para ayudar a los funcionarios a detectar y resolver observaciones."
    ),
)
async def revision_colaborativa(request: AsistenteColabRequest) -> AsistenteColabResponse:
    try:
        logger.info(
            "Revisión colaborativa - contexto: %d chars, consulta: '%s'",
            len(request.contexto),
            request.mensaje[:60],
        )
        respuesta = await _assistant_service.revision_colaborativa(
            mensaje=request.mensaje,
            contexto=request.contexto,
        )
        return AsistenteColabResponse(respuesta=respuesta)
    except Exception as error:
        logger.exception("Error en la revisión colaborativa")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error del asistente: {error}",
        )
