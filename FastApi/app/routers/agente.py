"""
NexusFlow AI — Router del Agente Clasificador de Políticas
==========================================================
POST /ai/agente/clasificar
  Body: { "descripcion": str, "empresa_id": str, "cliente_id": str? }
  Response: { politica_recomendada, politicas_candidatas, respuesta_agente, ... }

GET  /ai/agente/listar/{empresa_id}
  Response: lista de políticas activas de la empresa
"""

import logging
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, List, Any

from ..services.agente_service import AgenteService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/agente", tags=["IA - Agente Clasificador"])

_agente_service = AgenteService()


# ── Modelos ───────────────────────────────────────────────────────

class HistorialMsg(BaseModel):
    rol: str  # "user" | "agent"
    texto: str


class ClasificarRequest(BaseModel):
    descripcion: str = Field(..., min_length=1)
    empresa_id: str = Field(...)
    cliente_id: Optional[str] = None
    politica_contexto: Optional[str] = None
    historial: Optional[List[HistorialMsg]] = []
    paso_actual: Optional[int] = -1  # -1=sin paso; 0=primer paso mostrado; N=paso N mostrado
    tramite_lista_contexto: Optional[List[Any]] = []  # lista de {nombre, tramite_id} mostrada al cliente
    tramite_id_contexto: Optional[str] = None  # _id del trámite mostrado en el turno anterior


class PoliticaItem(BaseModel):
    nombre: str
    descripcion: str = ""
    tipo_flujo: str = ""
    duracion_dias: int = 0
    requisitos: List[Any] = []
    pasos: List[str] = []
    score: float = 0.0


class ClasificarResponse(BaseModel):
    politica_recomendada: Optional[PoliticaItem] = None
    politicas_candidatas: List[PoliticaItem] = []
    respuesta_agente: str
    confianza: float
    total_politicas_revisadas: int
    metodo: Optional[str] = None
    politica_mongo_id: Optional[str] = None
    puede_iniciar: bool = False
    paso_siguiente: Optional[int] = None  # índice del paso que se acaba de mostrar (0-based)
    tramites_contexto: Optional[List[Any]] = []  # lista de {nombre, tramite_id} para selección
    tramite_id: Optional[str] = None  # _id del trámite detallado en esta respuesta


# ── Endpoints ─────────────────────────────────────────────────────

@router.post("/clasificar", summary="Clasificar necesidad del cliente")
async def clasificar_necesidad(request: ClasificarRequest):
    try:
        logger.info("Agente — empresa: %s | texto: '%s...'",
                    request.empresa_id, request.descripcion[:80])

        historial_dicts = [h.model_dump() for h in (request.historial or [])]
        resultado = _agente_service.clasificar(
            descripcion=request.descripcion,
            empresa_id=request.empresa_id,
            cliente_id=request.cliente_id or "",
            historial=historial_dicts,
            politica_contexto=request.politica_contexto or "",
            paso_actual=request.paso_actual if request.paso_actual is not None else -1,
            tramite_lista_contexto=request.tramite_lista_contexto or [],
            tramite_id_contexto=request.tramite_id_contexto or "",
        )

        # Normalizar candidatas al modelo PoliticaItem
        candidatas = []
        for c in resultado.get("politicas_candidatas", []):
            candidatas.append(PoliticaItem(
                nombre=c.get("nombre", ""),
                descripcion=c.get("descripcion", ""),
                tipo_flujo=c.get("tipo_flujo", ""),
                duracion_dias=int(c.get("duracion_dias", 0)),
                requisitos=c.get("requisitos", []),
                pasos=c.get("pasos", []),
                score=float(c.get("score", 0.0)),
            ))

        recomendada = None
        rec = resultado.get("politica_recomendada")
        if rec:
            recomendada = PoliticaItem(
                nombre=rec.get("nombre", ""),
                descripcion=rec.get("descripcion", ""),
                tipo_flujo=rec.get("tipo_flujo", ""),
                duracion_dias=int(rec.get("duracion_dias", 0)),
                requisitos=rec.get("requisitos", []),
                pasos=rec.get("pasos", []),
                score=float(rec.get("score", 0.0)),
            )

        return ClasificarResponse(
            politica_recomendada=recomendada,
            politicas_candidatas=candidatas,
            respuesta_agente=resultado.get("respuesta_agente", ""),
            confianza=resultado.get("confianza", 0.0),
            total_politicas_revisadas=resultado.get("total_politicas_revisadas", 0),
            metodo=resultado.get("metodo"),
            politica_mongo_id=resultado.get("politica_mongo_id"),
            puede_iniciar=resultado.get("puede_iniciar", False),
            paso_siguiente=resultado.get("paso_siguiente"),
            tramites_contexto=resultado.get("tramites_contexto", []),
            tramite_id=resultado.get("tramite_id"),
        )

    except Exception as error:
        logger.exception("Error en agente clasificador")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error del agente: {error}",
        )


@router.get("/listar/{empresa_id}", summary="Listar políticas activas de la empresa")
async def listar_politicas(empresa_id: str):
    try:
        return _agente_service.listar_politicas(empresa_id)
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/estado", summary="Estado del agente clasificador")
async def estado_agente():
    from ..config import settings
    return {
        "estado": "activo",
        "modo": "ia_openai" if settings.is_api_mode else "keyword_matching",
        "version": "2.0.0",
    }
