"""
NexusFlow AI — Router de Reportes Dinámicos (Segundo Parcial)
=============================================================
Soporta consultas en lenguaje natural Y filtros estructurados.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from ..services.reporte_service import ReporteService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/reportes", tags=["IA - Reportes Dinámicos"])

_reporte_service = ReporteService()


class GenerarReporteRequest(BaseModel):
    consulta: str = Field(
        ..., min_length=3,
        description="Descripción en lenguaje natural del reporte deseado",
        json_schema_extra={"example": "Trámites finalizados del último mes"},
    )
    empresa_id: str = Field(
        ..., description="ID de la empresa",
        json_schema_extra={"example": "empresa-001"},
    )
    formato: str = Field(
        "excel", description="Formato: pdf, excel, word",
        json_schema_extra={"example": "excel"},
    )
    # Filtros estructurados opcionales (desde UI de filtros)
    coleccion: Optional[str] = Field(
        None, description="Forzar colección: Tramite | Bitacora | Politica",
    )
    estado: Optional[str] = Field(
        None, description="Filtrar Tramite por estado: finalizado|rechazado|en_proceso|...",
    )
    accion: Optional[str] = Field(
        None, description="Filtrar Bitacora por accion: APROBAR|RECHAZAR|OBSERVAR|...",
    )
    fecha_desde: Optional[str] = Field(
        None, description="Inicio rango fecha ISO: 2026-01-15",
    )
    fecha_hasta: Optional[str] = Field(
        None, description="Fin rango fecha ISO: 2026-06-30",
    )
    limite: Optional[int] = Field(
        None, ge=1, le=1000, description="Máximo de registros (1-1000)",
    )


class GenerarReporteResponse(BaseModel):
    archivo_b64: str = Field(..., description="Archivo en base64")
    nombre_archivo: str = Field(..., description="Nombre del archivo generado")
    mime_type: str = Field(..., description="MIME type")
    total_registros: int = Field(..., description="Registros incluidos")
    consulta_interpretada: str = Field(..., description="Cómo interpretó el sistema la consulta")
    formato: str = Field(..., description="Formato generado")
    coleccion_consultada: Optional[str] = None
    datos_preview: List[dict] = Field(default_factory=list, description="Primeras 20 filas para preview")
    estadisticas: dict = Field(default_factory=dict, description="Estadísticas para gráficos")
    columnas: List[str] = Field(default_factory=list, description="Columnas en orden")


@router.post(
    "/generar",
    response_model=GenerarReporteResponse,
    summary="Generar reporte dinámico",
    description=(
        "Genera un reporte en PDF, Excel o Word desde lenguaje natural o filtros estructurados. "
        "Incluye predicciones de ML (riesgo_ia, siguiente_accion_predicha) y estadísticas para gráficos."
    ),
)
async def generar_reporte(request: GenerarReporteRequest) -> GenerarReporteResponse:
    formato = request.formato.lower().strip()
    if formato not in ("pdf", "excel", "word", "xlsx", "docx"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato '{formato}' no soportado. Use: pdf, excel, word",
        )

    try:
        logger.info(
            "Reporte — empresa: %s | formato: %s | consulta: '%s' | col: %s | estado: %s",
            request.empresa_id, formato, request.consulta[:80],
            request.coleccion, request.estado,
        )

        resultado = _reporte_service.generar(
            consulta=request.consulta,
            empresa_id=request.empresa_id,
            formato=formato,
            coleccion=request.coleccion,
            estado=request.estado,
            accion=request.accion,
            fecha_desde=request.fecha_desde,
            fecha_hasta=request.fecha_hasta,
            limite=request.limite,
        )

        return GenerarReporteResponse(**resultado)

    except Exception as error:
        logger.exception("Error al generar reporte")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al generar reporte: {error}",
        )


@router.get("/estado", summary="Estado del servicio de reportes")
async def estado_reportes():
    from ..config import settings
    return {
        "estado": "activo",
        "formatos_disponibles": ["pdf", "excel", "word"],
        "filtros_estructurados": ["coleccion", "estado", "accion", "fecha_desde", "fecha_hasta", "limite"],
        "modo_interpretacion": "ia_openai" if settings.is_api_mode else "keyword_matching",
        "colecciones": ["Tramite", "Bitacora", "Politica"],
        "version": "2.0.0",
    }
