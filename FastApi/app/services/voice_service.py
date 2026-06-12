"""
NexusFlow AI - Servicio de Transcripción de Voz
================================================
Transcribe audio a texto y extrae entidades relevantes
para rellenar formularios automáticamente.

Dos modos de operación:
  - API: Usa OpenAI Whisper API para transcripción precisa
  - Local: Simulación con frases predefinidas (para desarrollo)
"""

import base64
import logging
import os
import random
import tempfile
from typing import Dict, Any

from openai import OpenAI, OpenAIError

from ..config import settings

logger = logging.getLogger(__name__)

# Formatos de audio soportados por Whisper API
FORMATOS_SOPORTADOS = {"wav", "mp3", "webm", "ogg", "m4a", "flac", "mp4", "mpeg", "mpga"}

# Frases que Whisper alucina cuando el audio es silencio/ruido ambient
ALUCINACIONES_CONOCIDAS = [
    "gracias por ver el video",
    "gracias por ver",
    "suscríbete",
    "like y suscríbete",
    "subtítulos realizados",
    "amara.org",
    "thanks for watching",
    "thank you for watching",
    "no olvides suscribirte",
    "dale like",
]

# Alucinaciones cortas — comparación exacta (stripped, lowercase)
ALUCINACIONES_EXACTAS = {
    ".", "..", "...",
    "subtítulos.", "subtitulos.", "música.", "musica.", "aplausos.",
    "gracias a todos.", "muchas gracias.",
}

# Frases de simulación para modo local (desarrollo sin API)
FRASES_SIMULACION = [
    "El cliente Juan Pérez con CI 12345678 solicita un crédito de 50000 bolivianos a 36 meses.",
    "La documentación presentada es válida y está actualizada al 15/04/2026.",
    "Se aprueba el crédito por el monto solicitado de 30000 dólares.",
    "Se requiere documentación adicional: certificado de ingresos y garantía hipotecaria.",
    "El informe técnico concluye que el proyecto es viable para instalación.",
    "Se rechaza la solicitud por falta de garantías suficientes.",
    "El análisis financiero muestra capacidad de pago del señor Rodríguez de 5000 bs mensuales.",
    "Se recomienda la aprobación con condiciones especiales para la señora María López.",
    "El cliente con teléfono 78945612 solicita vacaciones del 01/05/2026 al 15/05/2026.",
    "Informe de cotización: proveedor ABC ofrece 25000 bolivianos por los insumos solicitados.",
]


class VoiceService:
    """
    Servicio de transcripción de voz a texto.

    Utiliza OpenAI Whisper API en modo API o simulación en modo local.
    Después de la transcripción, extrae entidades del texto para
    rellenar formularios automáticamente.
    """

    def __init__(self):
        logger.info("VoiceService inicializado (modo IA: %s)", "API" if settings.is_api_mode else "LOCAL")

    @property
    def _client(self) -> OpenAI | None:
        """Cliente OpenAI según el modo IA actual (consultado en cada llamada para permitir alternar en runtime)."""
        if not settings.is_api_mode:
            return None
        if settings.openai_base_url:
            return OpenAI(api_key=settings.openai_api_key, base_url=settings.openai_base_url)
        return OpenAI(api_key=settings.openai_api_key)

    # --------------------------------------------------------
    # TRANSCRIPCIÓN PRINCIPAL
    # --------------------------------------------------------

    async def transcribir(self, audio_base64: str, formato: str) -> str:
        """
        Transcribe audio codificado en Base64 a texto.

        Args:
            audio_base64: Audio codificado en Base64.
            formato: Formato del audio (wav, mp3, webm, etc.).

        Returns:
            Texto transcrito del audio.
        """
        formato = formato.lower().strip()
        if formato not in FORMATOS_SOPORTADOS:
            logger.warning("Formato '%s' no soportado, usando wav por defecto", formato)
            formato = "wav"

        if self._client:
            try:
                return await self._transcribir_con_whisper(audio_base64, formato)
            except OpenAIError as error:
                logger.warning("Error con Whisper API, usando simulación: %s", error)
                return self._transcribir_simulacion()
        return self._transcribir_simulacion()

    # --------------------------------------------------------
    # TRANSCRIPCIÓN CON WHISPER API
    # --------------------------------------------------------

    async def _transcribir_con_whisper(self, audio_base64: str, formato: str) -> str:
        """Transcribe audio usando OpenAI Whisper API."""
        tmp_path = None
        try:
            # Decodificar Base64 a bytes (strip data URL prefix if present)
            if "," in audio_base64:
                audio_base64 = audio_base64.split(",", 1)[1]
            audio_bytes = base64.b64decode(audio_base64)
            logger.info("Audio decodificado: %d bytes, formato: %s", len(audio_bytes), formato)

            if len(audio_bytes) < 500:
                logger.warning("Audio demasiado corto (%d bytes) — posible silencio", len(audio_bytes))
                return ""

            # Guardar en archivo temporal
            with tempfile.NamedTemporaryFile(
                delete=False, suffix=f".{formato}", prefix="nexusflow_audio_"
            ) as tmp_file:
                tmp_file.write(audio_bytes)
                tmp_path = tmp_file.name

            # Enviar a Whisper API
            with open(tmp_path, "rb") as audio_file:
                transcripcion = self._client.audio.transcriptions.create(
                    model=settings.whisper_model,
                    file=audio_file,
                    language="es",
                    response_format="text",
                    temperature=0,
                    prompt="El usuario habla en español sobre trámites administrativos, solicitudes, consultas o instrucciones.",
                )

            texto = transcripcion.strip() if isinstance(transcripcion, str) else str(transcripcion)
            logger.info("Transcripción exitosa: '%s'", texto[:100])

            # Rechazar alucinaciones conocidas de Whisper (audio silencioso/ruidoso)
            lower = texto.lower().strip()
            if lower in ALUCINACIONES_EXACTAS or any(phrase in lower for phrase in ALUCINACIONES_CONOCIDAS):
                logger.warning("Alucinación detectada: '%s'", texto[:80])
                return ""

            return texto

        finally:
            # Limpiar archivo temporal
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

    # --------------------------------------------------------
    # SIMULACIÓN LOCAL (Desarrollo)
    # --------------------------------------------------------

    @staticmethod
    def _transcribir_simulacion() -> str:
        """Devuelve una frase simulada para modo de desarrollo."""
        frase = random.choice(FRASES_SIMULACION)
        logger.info("Transcripción simulada: '%s'", frase[:60])
        return frase

    # --------------------------------------------------------
    # EXTRACCIÓN DE DATOS DEL TEXTO
    # --------------------------------------------------------

    @staticmethod
    def extraer_datos_del_texto(texto: str) -> Dict[str, Any]:
        """
        Extrae datos estructurados del texto transcrito.
        Reutiliza el servicio NLP singleton para la extracción de entidades.
        """
        return _nlp_singleton.extraer_entidades(texto)


# Instancia compartida de NLPService (evita crear una nueva por cada llamada)
from .nlp_service import NLPService  # noqa: E402
_nlp_singleton = NLPService()
