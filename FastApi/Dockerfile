# ============================================================
# NexusFlow AI - Dockerfile
# ============================================================
# Imagen optimizada para producción con Python 3.11
# ============================================================

FROM python:3.11-slim AS base

# Metadatos del contenedor
LABEL maintainer="Equipo NexusFlow"
LABEL description="Microservicio de IA para NexusFlow Workflow"
LABEL version="1.0.0"

# Variables de entorno para Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Directorio de trabajo
WORKDIR /app

# ---- Instalar dependencias ----
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ---- Copiar código fuente ----
COPY ./app ./app

# ---- Crear usuario no-root por seguridad ----
RUN adduser --disabled-password --gecos '' appuser && \
    mkdir -p /app/ml_models/tensorflow && \
    chown -R appuser:appuser /app
USER appuser

# ---- Exponer puerto ----
EXPOSE 8000

# ---- Health check ----
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# ---- Comando de inicio ----
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
