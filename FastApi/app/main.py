"""
NexusFlow AI - Punto de Entrada Principal
==========================================
Microservicio de Inteligencia Artificial para el sistema
de gestión de flujos de trabajo NexusFlow.

Funcionalidades:
  - CU-17: Generación de diagramas desde lenguaje natural
  - CU-18: Transcripción de voz para formularios
  - CU-19: Detección de cuellos de botella y optimización
  - CU-20: Motor de aprendizaje predictivo desde Bitácora
  - Asistente contextual de IA para usuarios

Autor: Equipo NexusFlow
Versión: 2.0.0
"""

import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import diagram, voice, analytics, assistant, ml, tensorflow_ml, documentos, agente, reportes, sistema

# ============================================================
# CONFIGURACIÓN DE LOGGING
# ============================================================

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger("nexusflow-ai")


# ============================================================
# CICLO DE VIDA DE LA APLICACIÓN (Reemplaza on_event deprecado)
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gestiona el ciclo de vida: startup y shutdown del servicio."""
    # ---- STARTUP ----
    logger.info("=" * 60)
    logger.info("  NexusFlow AI - Microservicio de IA")
    logger.info("  Versión: 2.0.0")
    logger.info("  Modo IA: %s", "API (OpenAI)" if settings.is_api_mode else "LOCAL (Plantillas)")
    logger.info("  Spring Boot URL: %s", settings.spring_boot_url)
    logger.info("  MongoDB: %s/%s", settings.mongodb_uri, settings.mongodb_database)
    logger.info("  Motor ML: Habilitado (scikit-learn + TensorFlow)")
    logger.info("  Documentación: http://localhost:%d/docs", settings.port)
    logger.info("=" * 60)

    yield

    # ---- SHUTDOWN ----
    logger.info("NexusFlow AI - Servicio detenido correctamente")


# ============================================================
# CREACIÓN DE LA APLICACIÓN FASTAPI
# ============================================================

app = FastAPI(
    title="NexusFlow AI - Microservicio de IA",
    description=(
        "Servicio de Inteligencia Artificial para el sistema de workflow NexusFlow. "
        "Proporciona generación de diagramas desde lenguaje natural, "
        "transcripción de voz, detección de cuellos de botella, "
        "motor de aprendizaje predictivo y asistente contextual."
    ),
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=[
        {
            "name": "IA - Diagramas",
            "description": "Generación de diagramas de actividad desde lenguaje natural (CU-17)",
        },
        {
            "name": "IA - Voz",
            "description": "Transcripción de voz y extracción de entidades para formularios (CU-18)",
        },
        {
            "name": "IA - Analítica",
            "description": "Detección de cuellos de botella y recomendaciones de optimización (CU-19)",
        },
        {
            "name": "IA - Aprendizaje",
            "description": "Motor de aprendizaje predictivo desde la Bitácora (CU-20)",
        },
        {
            "name": "IA - Asistente",
            "description": "Asistente contextual que guía a los usuarios según su rol",
        },
        {
            "name": "IA - Agente Clasificador",
            "description": "Agente que analiza la necesidad del cliente y recomienda la política correcta (Segundo Parcial)",
        },
        {
            "name": "IA - Reportes Dinámicos",
            "description": "Genera reportes PDF/Excel/Word desde lenguaje natural (Segundo Parcial)",
        },
        {
            "name": "Sistema",
            "description": "Endpoints de salud y estado del servicio",
        },
    ],
)


# ============================================================
# MIDDLEWARE CORS (Para comunicación con Spring Boot y Angular)
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# REGISTRO DE ROUTERS
# ============================================================

app.include_router(diagram.router)
app.include_router(voice.router)
app.include_router(analytics.router)
app.include_router(assistant.router)
app.include_router(ml.router)
app.include_router(tensorflow_ml.router)  # Deep Learning — Segundo Parcial
app.include_router(documentos.router)     # Gestión Documental S3/MinIO — Segundo Parcial
app.include_router(agente.router)         # Agente Clasificador de Políticas — Segundo Parcial
app.include_router(reportes.router)       # Reportes Dinámicos — Segundo Parcial
app.include_router(sistema.router)        # Switch de modo IA en runtime — Segundo Parcial


# ============================================================
# ENDPOINTS DE SISTEMA
# ============================================================

@app.get(
    "/",
    tags=["Sistema"],
    summary="Información del servicio",
)
async def root():
    """Retorna información básica del servicio de IA."""
    return {
        "servicio": "NexusFlow AI - Microservicio de IA",
        "version": "2.0.0",
        "estado": "activo",
        "modo_ia": "api" if settings.is_api_mode else "local",
        "motor_ml": "habilitado",
        "documentacion": "/docs",
    }


@app.get(
    "/health",
    tags=["Sistema"],
    summary="Estado de salud del servicio",
)
async def health():
    """Endpoint de health check para Docker, Kubernetes y AWS."""
    return {
        "status": "healthy",
        "aiMode": "api" if settings.is_api_mode else "local",
        "mlEngine": "active",
        "version": "2.0.0",
    }
