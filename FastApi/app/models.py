"""
NexusFlow AI - Modelos de Datos (Pydantic)
==========================================
Define los esquemas de request/response para todos los
endpoints del microservicio de IA.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


# ============================================================
# MODELOS PARA GENERACIÓN DE DIAGRAMAS (CU-17)
# ============================================================

class DiagramRequest(BaseModel):
    """Solicitud para generar un diagrama de actividad desde lenguaje natural."""
    descripcion: str = Field(
        ...,
        min_length=10,
        description="Descripción en lenguaje natural del flujo de trabajo",
        json_schema_extra={"example": "Crear un flujo donde el cliente solicita crédito, un analista revisa documentos y el comité aprueba o rechaza"}
    )
    empresa_id: str = Field(
        ...,
        alias="empresaId",
        description="Identificador de la empresa"
    )

    class Config:
        populate_by_name = True


class DiagramResponse(BaseModel):
    """Respuesta con el diagrama de actividad generado."""
    nombre: str = Field(..., description="Nombre del proceso generado")
    nodos: List[Dict[str, Any]] = Field(..., description="Lista de nodos del diagrama")
    enlaces: List[Dict[str, str]] = Field(..., description="Lista de enlaces entre nodos")
    descripcion: str = Field(..., description="Descripción del diagrama generado")


# ============================================================
# MODELOS PARA TRANSCRIPCIÓN DE VOZ (CU-18)
# ============================================================

class VoiceRequest(BaseModel):
    """Solicitud para transcribir audio a texto y extraer entidades."""
    audio_base64: str = Field(
        ...,
        alias="audioBase64",
        description="Audio codificado en Base64"
    )
    formato: str = Field(
        default="webm",
        description="Formato del audio (wav, mp3, webm, ogg)"
    )
    tramite_id: Optional[str] = Field(
        default=None,
        alias="tramiteId",
        description="ID del trámite asociado (opcional para uso en editor de flujos)"
    )
    campo_id: Optional[str] = Field(
        default=None,
        alias="campoId",
        description="ID del campo del formulario a rellenar (opcional)"
    )

    class Config:
        populate_by_name = True


class VoiceResponse(BaseModel):
    """Respuesta con el texto transcrito y entidades extraídas."""
    texto: str = Field(..., description="Texto transcrito del audio")
    campo_id: Optional[str] = Field(default=None, alias="campoId", description="ID del campo asociado")
    tramite_id: Optional[str] = Field(default=None, alias="tramiteId", description="ID del trámite asociado")
    entidades: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Entidades extraídas del texto (montos, fechas, nombres)"
    )

    class Config:
        populate_by_name = True


# ============================================================
# MODELOS PARA ANALÍTICA Y OPTIMIZACIÓN (CU-19)
# ============================================================

class AnalyticsRequest(BaseModel):
    """Solicitud para analizar cuellos de botella en el workflow."""
    empresa_id: str = Field(
        ...,
        alias="empresaId",
        description="Identificador de la empresa"
    )
    tiempos_por_nodo: Dict[str, float] = Field(
        ...,
        alias="tiemposPorNodo",
        description="Mapa de nodoId → tiempo promedio en horas"
    )

    class Config:
        populate_by_name = True


class AnalyticsResponse(BaseModel):
    """Respuesta con cuellos de botella y recomendaciones."""
    cuellos_botella: List[Dict[str, Any]] = Field(
        ...,
        alias="cuellosBotella",
        description="Lista de cuellos de botella detectados"
    )
    recomendaciones: List[str] = Field(
        ...,
        description="Lista de recomendaciones para optimizar"
    )

    class Config:
        populate_by_name = True


# ============================================================
# MODELOS PARA ASISTENTE CONTEXTUAL
# ============================================================

class AssistantRequest(BaseModel):
    """Solicitud de ayuda al asistente de IA contextual."""
    mensaje: str = Field(
        ...,
        min_length=2,
        description="Mensaje o consulta del usuario"
    )
    rol_usuario: str = Field(
        default="funcionario",
        alias="rolUsuario",
        description="Rol del usuario: administrador, disenador, funcionario, cliente"
    )
    contexto_actual: Optional[str] = Field(
        default=None,
        alias="contextoActual",
        description="Pantalla o acción actual del usuario"
    )

    class Config:
        populate_by_name = True


class AssistantResponse(BaseModel):
    """Respuesta del asistente de IA."""
    respuesta: str = Field(..., description="Respuesta del asistente")
    sugerencias: List[str] = Field(
        default_factory=list,
        description="Sugerencias de acciones siguientes"
    )


class AsistenteColabRequest(BaseModel):
    """Consulta al asistente dentro del editor colaborativo (revisión entre funcionarios)."""
    mensaje: str = Field(..., min_length=2, description="Consulta del funcionario")
    contexto: str = Field(
        default="",
        description="Contexto completo: datos del trámite (BD), política/flujo y extracto del documento"
    )


class AsistenteColabResponse(BaseModel):
    """Respuesta del asistente colaborativo."""
    respuesta: str = Field(..., description="Análisis/ayuda del asistente")


# ============================================================
# MODELOS DE SALUD Y ESTADO
# ============================================================

class HealthResponse(BaseModel):
    """Respuesta del endpoint de salud."""
    status: str
    ai_mode: str = Field(..., alias="aiMode")
    version: str

    class Config:
        populate_by_name = True


# ============================================================
# MODELOS PARA MOTOR DE APRENDIZAJE (CU-20)
# ============================================================

class MLTrainResponse(BaseModel):
    """Respuesta del entrenamiento de modelos ML desde la Bitácora."""
    status: str = Field(..., description="Estado del entrenamiento: entrenado, insuficiente, error")
    mensaje: Optional[str] = Field(default=None, description="Mensaje descriptivo")
    fecha_entrenamiento: Optional[str] = Field(
        default=None,
        alias="fechaEntrenamiento",
        description="Fecha y hora del entrenamiento",
    )
    total_registros_bitacora: Optional[int] = Field(
        default=None,
        alias="totalRegistrosBitacora",
        description="Total de registros leídos de la Bitácora",
    )
    registros_procesados: Optional[int] = Field(
        default=None,
        alias="registrosProcesados",
        description="Registros válidos usados en el entrenamiento",
    )
    modelo_estado: Optional[Dict[str, Any]] = Field(
        default=None,
        alias="modeloEstado",
        description="Métricas del modelo de predicción de estado",
    )
    modelo_prioridad: Optional[Dict[str, Any]] = Field(
        default=None,
        alias="modeloPrioridad",
        description="Métricas del modelo de predicción de prioridad",
    )
    registros_actuales: Optional[int] = Field(default=None, alias="registrosActuales")
    registros_minimos: Optional[int] = Field(default=None, alias="registrosMinimos")

    class Config:
        populate_by_name = True


class MLPredictRequest(BaseModel):
    """Solicitud de predicción para un trámite específico."""
    tramite_id: str = Field(
        ...,
        alias="tramiteId",
        description="ID del trámite a predecir",
    )
    ultima_accion: str = Field(
        default="INICIO_PROCESO",
        alias="ultimaAccion",
        description="Última acción registrada en la Bitácora",
    )
    tiempo_en_nodo: float = Field(
        default=0.0,
        alias="tiempoEnNodo",
        description="Tiempo actual en el nodo (horas)",
    )
    semaforizacion: str = Field(
        default="Verde",
        description="Color del semáforo actual: Verde, Amarillo, Rojo",
    )
    cantidad_pasos: int = Field(
        default=0,
        alias="cantidadPasos",
        description="Cantidad de transiciones realizadas",
    )
    cantidad_campos: int = Field(
        default=0,
        alias="cantidadCampos",
        description="Cantidad de campos en el formulario actual",
    )

    class Config:
        populate_by_name = True


class MLPredictResponse(BaseModel):
    """Respuesta de predicción del motor de aprendizaje."""
    status: str = Field(..., description="Estado de la predicción")
    tramite_id: Optional[str] = Field(default=None, alias="tramiteId")
    estado_predicho: Optional[str] = Field(
        default=None,
        alias="estadoPredicho",
        description="Estado predicho: pendiente, en_progreso, observado, finalizado, rechazado",
    )
    confianza_estado: Optional[float] = Field(
        default=None,
        alias="confianzaEstado",
        description="Nivel de confianza de la predicción de estado (0 a 1)",
    )
    prioridad_recomendada: Optional[str] = Field(
        default=None,
        alias="prioridadRecomendada",
        description="Prioridad recomendada: Baja, Media, Alta",
    )
    confianza_prioridad: Optional[float] = Field(
        default=None,
        alias="confianzaPrioridad",
        description="Nivel de confianza de la predicción de prioridad (0 a 1)",
    )
    recomendacion: Optional[str] = Field(
        default=None,
        description="Recomendación textual generada por el modelo",
    )
    features_utilizadas: Optional[Dict[str, Any]] = Field(
        default=None,
        alias="featuresUtilizadas",
        description="Features numéricas usadas en la predicción",
    )
    mensaje: Optional[str] = Field(default=None)

    class Config:
        populate_by_name = True


class MLStatusResponse(BaseModel):
    """Respuesta del estado de los modelos de ML."""
    mongodb_conectado: bool = Field(..., alias="mongodbConectado")
    modelo_estado_cargado: bool = Field(..., alias="modeloEstadoCargado")
    modelo_prioridad_cargado: bool = Field(..., alias="modeloPrioridadCargado")
    registros_bitacora: Optional[Any] = Field(default=None, alias="registrosBitacora")
    tramites_totales: Optional[int] = Field(default=None, alias="tramitesTotales")
    ultimo_entrenamiento: Optional[str] = Field(default=None, alias="ultimoEntrenamiento")
    ultimo_accuracy_estado: Optional[float] = Field(default=None, alias="ultimoAccuracyEstado")
    ultimo_accuracy_prioridad: Optional[float] = Field(default=None, alias="ultimoAccuracyPrioridad")
    archivo_modelo_estado: Optional[str] = Field(default=None, alias="archivoModeloEstado")
    archivo_modelo_prioridad: Optional[str] = Field(default=None, alias="archivoModeloPrioridad")

    class Config:
        populate_by_name = True

