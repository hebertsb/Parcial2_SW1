"""
NexusFlow AI - Servicio de Analítica y Optimización
=====================================================
Detecta cuellos de botella en los flujos de trabajo y
genera recomendaciones inteligentes para optimización.

Dos modos de operación:
  - API: Usa OpenAI GPT para recomendaciones contextuales avanzadas
  - Local: Usa reglas estadísticas predefinidas
"""

import asyncio
import json
import logging
from typing import Dict, Any, List

from openai import OpenAI, OpenAIError

from ..config import settings
from .nlp_service import NLPService

logger = logging.getLogger(__name__)

# Umbrales de severidad (en horas)
UMBRAL_CRITICO = 72.0
UMBRAL_ALTO = 48.0
UMBRAL_MEDIO = 24.0

# Prompt del sistema para recomendaciones con GPT
SYSTEM_PROMPT_ANALYTICS = """Eres un consultor experto en optimización de procesos de negocio y workflows.

Analiza los siguientes datos de tiempos por nodo de un flujo de trabajo y genera recomendaciones específicas.

Para cada cuello de botella detectado, proporciona:
1. Severidad (CRITICO/ALTO/MEDIO)
2. Causa probable del retraso
3. Acción correctiva específica
4. Impacto esperado de la mejora

Responde en español con recomendaciones prácticas y accionables.
Usa emojis para indicar severidad: 🚨 CRÍTICO, ⚠️ ALTO, 📌 MEDIO, ✅ OK.

Responde en formato JSON:
{
  "recomendaciones": ["recomendación 1", "recomendación 2"],
  "resumen": "Resumen ejecutivo breve"
}"""


class AnalyticsService:
    """
    Servicio de analítica para detección de cuellos de botella
    y generación de recomendaciones de optimización.
    """

    def __init__(self):
        self._nlp = NLPService()
        logger.info("AnalyticsService inicializado (modo IA: %s)", "API" if settings.is_api_mode else "LOCAL")

    @property
    def _client(self) -> OpenAI | None:
        """Cliente OpenAI según el modo IA actual (consultado en cada llamada para permitir alternar en runtime)."""
        if not settings.is_api_mode:
            return None
        if settings.openai_base_url:
            return OpenAI(api_key=settings.openai_api_key, base_url=settings.openai_base_url)
        return OpenAI(api_key=settings.openai_api_key)

    # --------------------------------------------------------
    # DETECCIÓN DE CUELLOS DE BOTELLA
    # --------------------------------------------------------

    def detectar_cuellos_botella(self, tiempos_por_nodo: Dict[str, float]) -> List[Dict[str, Any]]:
        """
        Detecta cuellos de botella basados en tiempos promedio por nodo.

        Args:
            tiempos_por_nodo: Mapa de nodoId → tiempo promedio en horas.

        Returns:
            Lista de cuellos de botella con severidad y recomendación.
        """
        cuellos: List[Dict[str, Any]] = []

        if not tiempos_por_nodo:
            return cuellos

        # Calcular promedio y desviación para detección relativa
        valores = list(tiempos_por_nodo.values())
        promedio = sum(valores) / len(valores)

        for nodo_id, tiempo in sorted(tiempos_por_nodo.items(), key=lambda x: x[1], reverse=True):
            severidad = self._clasificar_severidad(tiempo)

            if severidad != "OK":
                desviacion = ((tiempo - promedio) / promedio * 100) if promedio > 0 else 0

                cuellos.append({
                    "nodoId": nodo_id,
                    "tiempoPromedioHoras": round(tiempo, 1),
                    "severidad": severidad,
                    "desviacionPorcentaje": round(desviacion, 1),
                    "recomendacion": self._generar_recomendacion_local(severidad, nodo_id, tiempo),
                })

        logger.info("Detectados %d cuellos de botella de %d nodos", len(cuellos), len(tiempos_por_nodo))
        return cuellos

    # --------------------------------------------------------
    # GENERACIÓN DE RECOMENDACIONES
    # --------------------------------------------------------

    async def generar_recomendaciones(self, tiempos_por_nodo: Dict[str, float]) -> List[str]:
        """
        Genera recomendaciones inteligentes de optimización.

        Usa GPT si está disponible, sino usa reglas locales.
        """
        if self._client and tiempos_por_nodo:
            try:
                return await self._recomendaciones_con_gpt(tiempos_por_nodo)
            except OpenAIError as error:
                logger.warning("Error con GPT para analytics, usando reglas locales: %s", error)

        return self._nlp.generar_recomendaciones(tiempos_por_nodo)

    # --------------------------------------------------------
    # RECOMENDACIONES CON GPT
    # --------------------------------------------------------

    async def _recomendaciones_con_gpt(self, tiempos_por_nodo: Dict[str, float]) -> List[str]:
        """Genera recomendaciones usando OpenAI GPT."""
        datos_texto = "\n".join(
            f"- Nodo '{nodo}': {tiempo:.1f} horas promedio"
            for nodo, tiempo in sorted(tiempos_por_nodo.items(), key=lambda x: x[1], reverse=True)
        )

        response = await asyncio.to_thread(
            self._client.chat.completions.create,
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_ANALYTICS},
                {"role": "user", "content": f"Analiza estos tiempos por nodo:\n{datos_texto}"},
            ],
            temperature=0.4,
            max_tokens=1000,
            response_format={"type": "json_object"},
        )

        contenido = response.choices[0].message.content
        resultado = json.loads(contenido)

        recomendaciones = resultado.get("recomendaciones", [])
        resumen = resultado.get("resumen", "")

        if resumen:
            recomendaciones.insert(0, f"📊 RESUMEN: {resumen}")

        return recomendaciones

    # --------------------------------------------------------
    # MÉTODOS AUXILIARES PRIVADOS
    # --------------------------------------------------------

    @staticmethod
    def _clasificar_severidad(tiempo: float) -> str:
        """Clasifica la severidad según el tiempo en horas."""
        if tiempo > UMBRAL_CRITICO:
            return "CRITICO"
        if tiempo > UMBRAL_ALTO:
            return "ALTO"
        if tiempo > UMBRAL_MEDIO:
            return "MEDIO"
        return "OK"

    @staticmethod
    def _generar_recomendacion_local(severidad: str, nodo_id: str, tiempo: float) -> str:
        """Genera una recomendación específica basada en reglas locales."""
        recomendaciones = {
            "CRITICO": (
                f"🚨 Reasignar personal URGENTE en nodo '{nodo_id}' ({tiempo:.0f}h). "
                f"Considerar automatización de tareas repetitivas o contratación temporal."
            ),
            "ALTO": (
                f"⚠️ Capacitar personal o redistribuir carga en nodo '{nodo_id}' ({tiempo:.0f}h). "
                f"Evaluar si hay dependencias bloqueantes que se puedan paralelizar."
            ),
            "MEDIO": (
                f"📌 Monitorear de cerca nodo '{nodo_id}' ({tiempo:.0f}h). "
                f"Implementar alertas tempranas para prevenir escalamiento."
            ),
        }
        return recomendaciones.get(severidad, f"Revisar nodo '{nodo_id}'")
