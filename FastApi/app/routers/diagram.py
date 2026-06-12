"""
NexusFlow AI - Router de Generación y Edición de Diagramas (CU-17)
===================================================================
Endpoints para generar y editar diagramas de actividad con swimlanes
a partir de descripciones en lenguaje natural.
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from ..models import DiagramRequest, DiagramResponse
from ..services.nlp_service import NLPService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ia", tags=["IA - Diagramas"])

# Instancia del servicio NLP (Singleton a nivel de módulo)
_nlp_service = NLPService()


class EditarDiagramaRequest(BaseModel):
    """Solicitud para editar un diagrama existente con IA."""
    instruccion: str = Field(..., min_length=5, description="Qué cambiar en el diagrama")
    diagramaActual: Dict[str, Any] = Field(..., description="Diagrama actual con pasos, relaciones y carriles")


@router.post(
    "/generar-diagrama",
    response_model=DiagramResponse,
    summary="Generar diagrama desde lenguaje natural",
    description=(
        "Recibe una descripción en lenguaje natural y genera un diagrama "
        "de actividad UML organizado en calles (swimlanes) con nodos y enlaces."
    ),
    responses={
        200: {"description": "Diagrama generado exitosamente"},
        422: {"description": "Error de validación en los datos enviados"},
        500: {"description": "Error interno al generar el diagrama"},
    },
)
async def generar_diagrama(request: DiagramRequest) -> DiagramResponse:
    """
    Genera un diagrama de actividad a partir de una descripción textual.

    **Ejemplo de descripción:**
    'Crear un flujo donde el cliente solicita crédito,
    un analista revisa los documentos, el comité aprueba o rechaza,
    y se notifica al cliente'

    La IA interpreta el texto y genera automáticamente:
    - Nodos con tipos (NODO_INICIO, TASK, GATEWAY, NODO_FIN)
    - Enlaces con condiciones de decisión
    - Asignación a calles/departamentos (swimlanes)
    """
    try:
        logger.info(
            "Solicitud de diagrama - Empresa: %s, Descripción: '%s'",
            request.empresa_id,
            request.descripcion[:80],
        )

        diagrama = await _nlp_service.generar_diagrama(request.descripcion)

        return DiagramResponse(
            nombre=diagrama["nombre"],
            nodos=diagrama["nodos"],
            enlaces=diagrama["enlaces"],
            descripcion=diagrama.get("descripcion", "Diagrama generado por IA"),
        )

    except ValueError as error:
        logger.error("Error de validación al generar diagrama: %s", error)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Error de validación: {error}",
        )
    except Exception as error:
        logger.exception("Error inesperado al generar diagrama")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al generar diagrama: {error}",
        )


@router.post(
    "/editar-diagrama",
    response_model=DiagramResponse,
    summary="Editar un diagrama existente con instrucción en lenguaje natural",
    description=(
        "Recibe el diagrama actual y una instrucción de edición. "
        "La IA modifica el diagrama según la instrucción: agregar/eliminar nodos, "
        "renombrar calles, agregar campos, cambiar conexiones, etc."
    ),
)
async def editar_diagrama(request: EditarDiagramaRequest) -> DiagramResponse:
    """
    Edita un diagrama existente según una instrucción en lenguaje natural.

    **Ejemplos de instrucción:**
    - 'Agrega un carril de Legal después de Análisis'
    - 'Añade un paso de revisión jurídica entre Evaluación y Aprobación'
    - 'Cambia el nombre del carril COMITE a DIRECTORIO'
    - 'Agrega un campo de firma digital al paso de Aprobación'
    """
    try:
        logger.info("Solicitud de edición - Instrucción: '%s'", request.instruccion[:80])
        diagrama = await _nlp_service.editar_diagrama(request.diagramaActual, request.instruccion)
        return DiagramResponse(
            nombre=diagrama["nombre"],
            nodos=diagrama["nodos"],
            enlaces=diagrama["enlaces"],
            descripcion=diagrama.get("descripcion", "Diagrama editado por IA"),
        )
    except Exception as error:
        logger.exception("Error al editar diagrama")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al editar diagrama: {error}",
        )
