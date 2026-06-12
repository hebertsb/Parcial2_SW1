"""
NexusFlow AI — Servicio de Almacenamiento S3 / MinIO (Segundo Parcial)
=======================================================================
Gestión de documentos de trámites usando almacenamiento compatible con S3.

En LOCAL/DOCKER: usa MinIO (gratuito, S3-compatible, corre en Docker)
En PRODUCCIÓN:   cambia S3_ENDPOINT_URL a None → usa AWS S3 real

Estructura en el bucket:
  nexusflow-documentos/
  └── {empresa_id}/
      └── {politica_id}/
          └── {tramite_id}/
              ├── contrato.pdf
              ├── formulario.docx
              └── evidencia.jpg

Por qué MinIO:
  - Mismo API que AWS S3 (boto3 sin cambios)
  - Gratis, corre en Docker
  - Para producción solo cambia el endpoint_url
"""

import logging
import mimetypes
import re
import unicodedata
from datetime import datetime
from io import BytesIO
from typing import Optional

from ..config import settings

logger = logging.getLogger(__name__)


def _limpiar_nombre(nombre: str) -> str:
    """Normaliza texto para usar como segmento de ruta S3 (sin tildes, sin caracteres especiales)."""
    nfd = unicodedata.normalize("NFD", nombre or "sin_nombre")
    sin_tildes = "".join(c for c in nfd if unicodedata.category(c) != "Mn")
    limpio = re.sub(r"[^\w\s\-]", "", sin_tildes)
    limpio = re.sub(r"[\s]+", "_", limpio.strip())
    return limpio[:50] or "sin_nombre"


class S3Service:
    """
    Servicio de almacenamiento S3-compatible.
    Usa MinIO en desarrollo y AWS S3 en producción — mismo código.
    """

    def __init__(self):
        self._client = None
        self._disponible = False
        self._intentar_conectar()

    def _intentar_conectar(self) -> None:
        try:
            import boto3
            from botocore.client import Config

            kwargs = dict(
                region_name=settings.s3_region,
                aws_access_key_id=settings.s3_access_key or "minioadmin",
                aws_secret_access_key=settings.s3_secret_key or "minioadmin",
            )
            if settings.s3_endpoint_url:
                # MinIO local
                kwargs["endpoint_url"] = settings.s3_endpoint_url
                kwargs["config"] = Config(signature_version="s3v4")

            self._client = boto3.client("s3", **kwargs)
            self._asegurar_bucket()
            self._disponible = True
            modo = "MinIO" if settings.s3_endpoint_url else "AWS S3"
            logger.info("S3Service conectado — modo: %s, bucket: %s", modo, settings.s3_bucket_name)
        except ImportError:
            logger.warning("boto3 no instalado — S3 deshabilitado")
        except Exception as e:
            logger.warning("S3Service no disponible: %s", e)

    def _asegurar_bucket(self) -> None:
        """Crea el bucket si no existe y lo configura para lectura pública (MinIO local)."""
        try:
            self._client.head_bucket(Bucket=settings.s3_bucket_name)
        except Exception:
            try:
                if settings.s3_region == "us-east-1":
                    self._client.create_bucket(Bucket=settings.s3_bucket_name)
                else:
                    self._client.create_bucket(
                        Bucket=settings.s3_bucket_name,
                        CreateBucketConfiguration={"LocationConstraint": settings.s3_region}
                    )
                logger.info("Bucket creado: %s", settings.s3_bucket_name)
            except Exception as e:
                logger.warning("No se pudo crear bucket: %s", e)

        # Política pública de lectura (solo MinIO local — para que browser y OnlyOffice accedan sin firma)
        if settings.s3_endpoint_url:
            self._aplicar_politica_publica()

    def _aplicar_politica_publica(self) -> None:
        import json
        policy = json.dumps({
            "Version": "2012-10-17",
            "Statement": [{
                "Sid": "PublicRead",
                "Effect": "Allow",
                "Principal": {"AWS": "*"},
                "Action": "s3:GetObject",
                "Resource": f"arn:aws:s3:::{settings.s3_bucket_name}/*"
            }]
        })
        try:
            self._client.put_bucket_policy(Bucket=settings.s3_bucket_name, Policy=policy)
            logger.info("Bucket '%s' configurado como público (lectura)", settings.s3_bucket_name)
        except Exception as e:
            logger.warning("No se pudo aplicar política pública al bucket: %s", e)

    def _build_key(
        self,
        empresa_id: str,
        tramite_id: str,
        nombre_archivo: str,
        politica_nombre: str = "",
        cliente_nombre: str = "",
        politica_id: str = "",
    ) -> str:
        """
        Estructura: empresa_id/NombrePolitica/NombreCliente/tramite_id/archivo
        Si no hay nombres legibles, usa IDs como fallback.
        """
        pol_seg = _limpiar_nombre(politica_nombre) if politica_nombre else _limpiar_nombre(politica_id)
        cli_seg = _limpiar_nombre(cliente_nombre) if cliente_nombre else "cliente"
        nombre_limpio = nombre_archivo.replace(" ", "_")
        return f"{empresa_id}/{pol_seg}/{cli_seg}/{tramite_id}/{nombre_limpio}"

    # ── Subir archivo ──────────────────────────────────────────

    def subir_archivo(
        self,
        contenido: bytes,
        nombre_archivo: str,
        empresa_id: str,
        politica_id: str,
        tramite_id: str,
        subido_por: str = "sistema",
        metadata: Optional[dict] = None,
        politica_nombre: str = "",
        cliente_nombre: str = "",
    ) -> dict:
        """
        Sube un archivo al bucket.
        Estructura: empresa_id/NombrePolitica/NombreCliente/tramite_id/archivo
        """
        if not self._disponible:
            return {"error": "Almacenamiento S3 no disponible"}

        try:
            key = self._build_key(
                empresa_id, tramite_id, nombre_archivo,
                politica_nombre=politica_nombre,
                cliente_nombre=cliente_nombre,
                politica_id=politica_id,
            )
            content_type = mimetypes.guess_type(nombre_archivo)[0] or "application/octet-stream"

            extra_meta = {
                "subido-por": subido_por,
                "fecha-subida": datetime.now().isoformat(),
                "empresa-id": empresa_id,
                "tramite-id": tramite_id,
                "politica-id": politica_id,
            }
            if metadata:
                extra_meta.update({k: str(v) for k, v in metadata.items()})

            self._client.put_object(
                Bucket=settings.s3_bucket_name,
                Key=key,
                Body=BytesIO(contenido),
                ContentType=content_type,
                Metadata=extra_meta,
            )

            logger.info("Archivo subido: %s (%d bytes)", key, len(contenido))
            return {
                "key": key,
                "nombre": nombre_archivo,
                "tamanio_bytes": len(contenido),
                "content_type": content_type,
                "empresa_id": empresa_id,
                "politica_id": politica_id,
                "tramite_id": tramite_id,
                "subido_por": subido_por,
                "fecha_subida": extra_meta["fecha-subida"],
                "url_descarga": self._generar_url_descarga(key),
            }
        except Exception as e:
            logger.exception("Error subiendo archivo")
            return {"error": str(e)}

    # ── Listar archivos de un trámite ──────────────────────────

    def listar_archivos(
        self,
        empresa_id: str,
        politica_id: str,
        tramite_id: str,
        politica_nombre: str = "",
        cliente_nombre: str = "",
    ) -> list:
        """
        Lista documentos de un trámite buscando en la nueva estructura (nombres)
        y en la antigua (IDs) para compatibilidad con archivos previos.
        """
        if not self._disponible:
            return []

        pol_seg = _limpiar_nombre(politica_nombre) if politica_nombre else _limpiar_nombre(politica_id)
        cli_seg = _limpiar_nombre(cliente_nombre) if cliente_nombre else "cliente"

        prefijos = [
            f"{empresa_id}/{pol_seg}/{cli_seg}/{tramite_id}/",   # nueva estructura
            f"{empresa_id}/{politica_id}/{tramite_id}/",          # estructura anterior
        ]

        keys_vistos: set = set()
        archivos_total: list = []

        for prefix in prefijos:
            try:
                response = self._client.list_objects_v2(
                    Bucket=settings.s3_bucket_name,
                    Prefix=prefix,
                )
                for obj in response.get("Contents", []):
                    key = obj["Key"]
                    if key in keys_vistos:
                        continue
                    keys_vistos.add(key)
                    nombre = key.split("/")[-1]
                    try:
                        head = self._client.head_object(Bucket=settings.s3_bucket_name, Key=key)
                        meta = head.get("Metadata", {})
                    except Exception:
                        meta = {}
                    archivos_total.append({
                        "key": key,
                        "nombre": nombre,
                        "tamanio_bytes": obj["Size"],
                        "fecha_modificacion": obj["LastModified"].isoformat(),
                        "subido_por": meta.get("subido-por", "desconocido"),
                        "fecha_subida": meta.get("fecha-subida"),
                        "url_descarga": self._generar_url_descarga(key),
                        "content_type": mimetypes.guess_type(nombre)[0] or "application/octet-stream",
                    })
            except Exception as e:
                logger.error("Error listando archivos prefix=%s: %s", prefix, e)

        return archivos_total

    # ── URL pre-firmada para descarga ─────────────────────────

    def _generar_url_descarga(self, key: str, expira_segundos: int = 3600) -> str:
        """URL pública directa (MinIO) o pre-firmada (AWS S3)."""
        if not self._disponible:
            return ""
        try:
            if settings.s3_endpoint_url:
                # MinIO: bucket es público, URL directa accesible desde browser vía localhost:9000
                browser_endpoint = settings.s3_endpoint_url.replace("minio:9000", "localhost:9000")
                return f"{browser_endpoint}/{settings.s3_bucket_name}/{key}"
            # AWS S3: URL pre-firmada temporal
            return self._client.generate_presigned_url(
                "get_object",
                Params={"Bucket": settings.s3_bucket_name, "Key": key},
                ExpiresIn=expira_segundos,
            )
        except Exception:
            return ""

    def generar_url_descarga(self, key: str, expira_segundos: int = 3600) -> str:
        return self._generar_url_descarga(key, expira_segundos)

    # ── Eliminar archivo ───────────────────────────────────────

    def descargar_archivo(self, key: str) -> dict:
        """Descarga un archivo de S3/MinIO y retorna el body stream y metadata."""
        if not self._disponible:
            return {"error": "S3 no disponible"}
        try:
            nombre = key.split("/")[-1]
            content_type = mimetypes.guess_type(nombre)[0] or "application/octet-stream"
            obj = self._client.get_object(Bucket=settings.s3_bucket_name, Key=key)
            return {"body": obj["Body"], "content_type": content_type, "nombre": nombre}
        except Exception as e:
            return {"error": str(e)}

    def eliminar_archivo(self, key: str) -> dict:
        if not self._disponible:
            return {"error": "S3 no disponible"}
        try:
            self._client.delete_object(Bucket=settings.s3_bucket_name, Key=key)
            return {"eliminado": True, "key": key}
        except Exception as e:
            return {"error": str(e)}

    # ── Guardar contenido directo (editor colaborativo) ────────

    def subir_contenido_directo(self, key: str, contenido: bytes, content_type: str = "text/html") -> dict:
        """Guarda contenido directamente con una key existente (para editor TipTap)."""
        if not self._disponible:
            return {"error": "S3 no disponible"}

        try:
            self._client.put_object(
                Bucket=settings.s3_bucket_name,
                Key=key,
                Body=BytesIO(contenido),
                ContentType=content_type,
                Metadata={
                    "guardado-por": "editor-colaborativo",
                    "fecha": datetime.now().isoformat(),
                }
            )
            logger.info("Contenido guardado: %s (%d bytes)", key, len(contenido))
            return {"success": True, "key": key, "bytes": len(contenido)}
        except Exception as e:
            logger.exception("Error guardando contenido")
            return {"error": str(e)}

    # ── Estado del servicio ────────────────────────────────────

    def estado(self) -> dict:
        modo = "MinIO (local)" if settings.s3_endpoint_url else "AWS S3"
        return {
            "disponible": self._disponible,
            "modo": modo,
            "endpoint": settings.s3_endpoint_url or "AWS S3 default",
            "bucket": settings.s3_bucket_name,
            "region": settings.s3_region,
        }


# Singleton
_s3_instance: Optional[S3Service] = None


def get_s3_service() -> S3Service:
    global _s3_instance
    if _s3_instance is None:
        _s3_instance = S3Service()
    return _s3_instance
