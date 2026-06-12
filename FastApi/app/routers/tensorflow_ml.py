"""
NexusFlow AI - Router TensorFlow Deep Learning (Segundo Parcial)
================================================================
Endpoints del motor inteligente de enrutamiento y análisis de riesgo.
Implementa los 3 modelos de deep learning pedidos por el ing.
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from ..services.tensorflow_service import get_tf_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tf", tags=["Deep Learning - TensorFlow"])


# ── Modelos Pydantic de entrada/salida ─────────────────────────

class EntrenarRequest(BaseModel):
    forzar: bool = Field(False, description="Forzar reentrenamiento aunque ya existan modelos")


class RutaRequest(BaseModel):
    secuencia_acciones: List[str] = Field(
        ...,
        description="Historial de acciones del trámite (última a primero)",
        example=["INICIO_PROCESO", "LLENADO_FORMULARIO", "APROBAR"]
    )


class RiesgoRequest(BaseModel):
    tiempo_en_nodo: float = Field(0.0, ge=0, description="Horas que lleva en el nodo actual")
    campos_configurados: int = Field(0, ge=0, description="Número de campos del formulario")
    numero_documentos: int = Field(0, ge=0, description="Documentos adjuntos")
    hora_dia: float = Field(12.0, ge=0, le=23, description="Hora del día (0-23)")
    dia_semana: float = Field(1.0, ge=0, le=6, description="Día de la semana (0=lunes)")
    ultima_accion: str = Field("", description="Última acción registrada")


class AnomaliaRequest(BaseModel):
    tiempo_en_nodo: float = Field(0.0, ge=0)
    campos_configurados: int = Field(0, ge=0)
    numero_documentos: int = Field(0, ge=0)
    hora_dia: float = Field(12.0, ge=0, le=23)
    dia_semana: float = Field(1.0, ge=0, le=6)
    ultima_accion: str = Field("")


# ── Endpoints ──────────────────────────────────────────────────

@router.post(
    "/entrenar",
    summary="Entrenar los 3 modelos TensorFlow",
    description=(
        "Entrena el LSTM (predictor de ruta), la red densa (riesgo de demora) "
        "y el autoencoder (detección de anomalías) usando datos de la Bitácora. "
        "El primer entrenamiento puede tardar 30-120 segundos según los datos disponibles."
    )
)
async def entrenar_modelos(request: EntrenarRequest = EntrenarRequest()):
    """
    Entrena los 3 modelos de deep learning sobre la Bitácora de MongoDB.
    - LSTM: aprende secuencias de acciones para predecir el siguiente paso
    - Dense: aprende patrones de demora para predecir riesgo
    - Autoencoder: aprende distribución normal para detectar anomalías
    """
    try:
        svc = get_tf_service()
        resultado = svc.entrenar()
        if "error" in resultado:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=resultado["error"])
        return resultado
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error entrenando modelos TF")
        raise HTTPException(status_code=500, detail=f"Error en entrenamiento: {e}")


@router.post(
    "/predecir-ruta",
    summary="Predecir siguiente nodo en el flujo (LSTM)",
    description=(
        "Dado el historial de acciones de un trámite, predice cuál será la siguiente "
        "acción más probable usando el modelo LSTM entrenado."
    )
)
async def predecir_ruta(request: RutaRequest):
    """
    Modelo: LSTM Sequence Predictor
    Input: Lista de acciones previas del trámite
    Output: Siguiente acción más probable + distribución de probabilidades
    """
    try:
        svc = get_tf_service()
        return svc.predecir_ruta(request.secuencia_acciones)
    except Exception as e:
        logger.exception("Error prediciendo ruta")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/riesgo-demora",
    summary="Predecir riesgo de demora en trámite (Red Densa)",
    description=(
        "Analiza las características actuales del trámite y predice la probabilidad "
        "de que sufra una demora o cuello de botella. Retorna nivel de riesgo y recomendación."
    )
)
async def predecir_riesgo(request: RiesgoRequest):
    """
    Modelo: Dense Neural Network (clasificador binario)
    Input: Features del trámite (tiempo, campos, documentos, hora, acción)
    Output: Probabilidad 0-1 de demora + nivel de riesgo + recomendación
    """
    try:
        svc = get_tf_service()
        return svc.predecir_riesgo_demora(request.model_dump())
    except Exception as e:
        logger.exception("Error prediciendo riesgo")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/detectar-anomalia",
    summary="Detectar anomalías en trámite (Autoencoder)",
    description=(
        "Usa un autoencoder para detectar si el patrón actual del trámite es anómalo "
        "comparado con el comportamiento normal aprendido durante el entrenamiento."
    )
)
async def detectar_anomalia(request: AnomaliaRequest):
    """
    Modelo: Autoencoder (encoder-decoder)
    Input: Features del trámite
    Output: Score de anomalía + umbral + clasificación NORMAL/ANÓMALO
    """
    try:
        svc = get_tf_service()
        return svc.detectar_anomalia(request.model_dump())
    except Exception as e:
        logger.exception("Error detectando anomalía")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/estado",
    summary="Estado de los modelos TensorFlow",
    description="Retorna qué modelos están entrenados, versión de TF y métricas del último entrenamiento."
)
async def estado_modelos():
    """Información sobre los 3 modelos TF y si están listos para usar."""
    try:
        svc = get_tf_service()
        return svc.estado()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
