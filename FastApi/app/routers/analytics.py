"""
NexusFlow AI - Router de Analítica y Optimización (CU-19)
=========================================================
Endpoint para detectar cuellos de botella y generar
recomendaciones de optimización del workflow.
"""

import logging

from fastapi import APIRouter, HTTPException, status

from ..models import AnalyticsRequest, AnalyticsResponse
from ..services.analytics_service import AnalyticsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["IA - Analítica"])

# Instancia del servicio de analítica (Singleton a nivel de módulo)
_analytics_service = AnalyticsService()


@router.post(
    "/cuellos-botella",
    response_model=AnalyticsResponse,
    summary="Detectar cuellos de botella y generar recomendaciones",
    description=(
        "Recibe los tiempos promedio por nodo de un workflow y detecta "
        "cuellos de botella clasificados por severidad (CRITICO, ALTO, MEDIO). "
        "Genera recomendaciones inteligentes de optimización."
    ),
    responses={
        200: {"description": "Análisis completado exitosamente"},
        422: {"description": "Error de validación en los datos"},
        500: {"description": "Error interno al analizar"},
    },
)
async def detectar_cuellos_botella(request: AnalyticsRequest) -> AnalyticsResponse:
    """
    Analiza tiempos de ejecución y detecta nodos problemáticos.

    **Severidades:**
    - 🚨 CRÍTICO: > 72 horas promedio
    - ⚠️ ALTO: > 48 horas promedio
    - 📌 MEDIO: > 24 horas promedio

    **Ejemplo de entrada:**
    ```json
    {
      "empresaId": "emp-001",
      "tiemposPorNodo": {
        "Revisión de Documentos": 96.5,
        "Aprobación del Comité": 120.0,
        "Notificación": 2.3
      }
    }
    ```
    """
    try:
        logger.info(
            "Solicitud de analítica - Empresa: %s, Nodos: %d",
            request.empresa_id,
            len(request.tiempos_por_nodo),
        )

        # Detectar cuellos de botella
        cuellos = _analytics_service.detectar_cuellos_botella(request.tiempos_por_nodo)

        # Generar recomendaciones inteligentes
        recomendaciones = await _analytics_service.generar_recomendaciones(
            request.tiempos_por_nodo
        )

        logger.info(
            "Análisis completado - Cuellos: %d, Recomendaciones: %d",
            len(cuellos),
            len(recomendaciones),
        )

        return AnalyticsResponse(
            cuellosBotella=cuellos,
            recomendaciones=recomendaciones,
        )

    except Exception as error:
        logger.exception("Error al analizar cuellos de botella")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al analizar: {error}",
        )
