"""
NexusFlow AI - Router de Aprendizaje Automático (CU-20)
========================================================
Endpoints para entrenar, predecir y consultar el estado
del motor de aprendizaje desde la Bitácora.
"""

import logging

from fastapi import APIRouter, HTTPException, status

from ..models import (
    MLTrainResponse,
    MLPredictRequest,
    MLPredictResponse,
    MLStatusResponse,
)
from ..services.ml_service import MLService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ia", tags=["IA - Aprendizaje"])

# Instancia del servicio de ML (Singleton a nivel de módulo)
_ml_service = MLService()


# ============================================================
# ENDPOINT 1: ENTRENAR MODELOS DESDE LA BITÁCORA
# ============================================================

@router.post(
    "/entrenar",
    response_model=MLTrainResponse,
    summary="Entrenar modelos desde la Bitácora de MongoDB",
    description=(
        "Lee la colección Bitácora, extrae features de los registros históricos "
        "y entrena modelos RandomForest y GradientBoosting para predecir "
        "el estado y la prioridad de trámites futuros. "
        "Los modelos se persisten en disco y las métricas se guardan en Base_Conocimiento_IA."
    ),
    responses={
        200: {"description": "Entrenamiento completado exitosamente"},
        500: {"description": "Error interno durante el entrenamiento"},
    },
)
async def entrenar_modelo() -> MLTrainResponse:
    """
    Entrena los modelos de ML desde la Bitácora.

    **Flujo:**
    1. Lee la colección `Bitacora` de MongoDB
    2. Enriquece con datos de la colección `Tramite`
    3. Construye features numéricas (acciones, tiempos, semáforos)
    4. Entrena RandomForest (estado) y GradientBoosting (prioridad)
    5. Persiste modelos como `.pkl` en disco
    6. Registra métricas en `Base_Conocimiento_IA`

    **Requisitos:**
    - Al menos 30 registros en la Bitácora
    - MongoDB activo en la misma instancia que Spring Boot
    """
    try:
        logger.info("Solicitud de entrenamiento recibida")
        resultado = _ml_service.entrenar_desde_bitacora()
        logger.info("Entrenamiento finalizado con status: %s", resultado.get("status"))
        return MLTrainResponse(**resultado)

    except Exception as error:
        logger.exception("Error durante el entrenamiento de modelos")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al entrenar modelos: {error}",
        )


# ============================================================
# ENDPOINT 2: PREDECIR ESTADO Y PRIORIDAD
# ============================================================

@router.post(
    "/predecir",
    response_model=MLPredictResponse,
    summary="Predecir estado y prioridad de un trámite",
    description=(
        "Recibe los datos actuales de un trámite y predice su estado "
        "probable y prioridad recomendada usando los modelos entrenados. "
        "Incluye nivel de confianza y recomendación contextual."
    ),
    responses={
        200: {"description": "Predicción generada exitosamente"},
        422: {"description": "Error de validación en los datos"},
        500: {"description": "Error interno al predecir"},
    },
)
async def predecir_tramite(request: MLPredictRequest) -> MLPredictResponse:
    """
    Predice el estado y prioridad de un trámite.

    **Ejemplo de entrada:**
    ```json
    {
      "tramiteId": "tram-001",
      "ultimaAccion": "APROBAR",
      "tiempoEnNodo": 48.5,
      "semaforizacion": "Amarillo",
      "cantidadPasos": 3,
      "cantidadCampos": 5
    }
    ```
    """
    try:
        datos = {
            "tramite_id": request.tramite_id,
            "ultima_accion": request.ultima_accion,
            "tiempo_en_nodo": request.tiempo_en_nodo,
            "semaforizacion": request.semaforizacion,
            "cantidad_pasos": request.cantidad_pasos,
            "cantidad_campos": request.cantidad_campos,
        }

        logger.info(
            "Solicitud de predicción — Trámite: %s, Acción: %s",
            request.tramite_id,
            request.ultima_accion,
        )

        resultado = _ml_service.predecir(datos)

        return MLPredictResponse(**resultado)

    except Exception as error:
        logger.exception("Error al predecir trámite")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al predecir: {error}",
        )


# ============================================================
# ENDPOINT 3: ESTADO DE LOS MODELOS
# ============================================================

@router.get(
    "/estado-modelo",
    response_model=MLStatusResponse,
    summary="Consultar estado de los modelos de ML",
    description=(
        "Retorna información detallada sobre los modelos entrenados: "
        "si están cargados, última fecha de entrenamiento, accuracy, "
        "y cantidad de registros disponibles en la Bitácora."
    ),
    responses={
        200: {"description": "Estado de los modelos obtenido exitosamente"},
    },
)
async def obtener_estado_modelo() -> MLStatusResponse:
    """
    Consulta el estado actual del motor de aprendizaje.

    Útil para verificar:
    - Si hay modelos entrenados disponibles
    - Cuántos registros hay en la Bitácora
    - Cuándo fue el último entrenamiento
    - Accuracy de los modelos
    """
    try:
        estado = _ml_service.obtener_estado_modelo()
        return MLStatusResponse(**estado)

    except Exception as error:
        logger.exception("Error al obtener estado del modelo")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al consultar estado: {error}",
        )
