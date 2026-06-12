"""
NexusFlow AI - Servicio de Asistente Contextual
=================================================
Agente de IA que guía a los usuarios según su rol y
contexto actual. El Ing. pidió que el software tenga
un asistente que ayude a los usuarios a utilizar la app.

El agente se adapta según:
  - Rol del usuario (administrador, diseñador, funcionario, cliente)
  - Pantalla/acción actual del usuario
  - Historial de interacciones
"""

import asyncio
import json
import logging
from typing import Dict, List, Optional

from openai import OpenAI, OpenAIError

from ..config import settings

logger = logging.getLogger(__name__)

# ============================================================
# PROMPT DEL SISTEMA PARA EL ASISTENTE
# ============================================================

SYSTEM_PROMPT_ASISTENTE = """Eres NexusBot, el asistente de IA integrado en NexusFlow, un sistema de gestión de flujos de trabajo (Workflow).

Tu propósito es ayudar a los usuarios a utilizar el software de manera eficiente según su rol.

ROLES Y CAPACIDADES:
1. **Administrador**: Gestiona políticas de negocio, usuarios, roles y configuración general.
2. **Diseñador**: Crea y edita diagramas de actividad (workflows) con swimlanes/calles.
3. **Funcionario**: Ejecuta tareas dentro de los flujos, llena formularios e informes.
4. **Cliente**: Consulta el estado de sus trámites y recibe notificaciones.

REGLAS:
- Responde SIEMPRE en español.
- Sé conciso pero completo.
- Adapta tu ayuda al rol y contexto del usuario.
- Si el usuario está en una pantalla específica, guíalo paso a paso.
- Ofrece 2-3 sugerencias de acciones que podría realizar.
- Usa un tono profesional pero amigable.

Responde en formato JSON:
{
  "respuesta": "Tu respuesta de ayuda aquí",
  "sugerencias": ["Sugerencia 1", "Sugerencia 2", "Sugerencia 3"]
}"""


SYSTEM_PROMPT_COLABORATIVO = """Eres NexusBot Revisor, el asistente de IA del editor colaborativo de NexusFlow.

Tu rol: ayudar a FUNCIONARIOS que están revisando juntos la documentación de un trámite
(ej. una unidad valida documentos y otra confirma la validación para desembolso en un banco).

Recibirás como contexto:
1. DATOS DEL TRÁMITE (base de datos): estado, nodo actual, semáforo, respuestas del cliente, historial.
2. POLÍTICA / FLUJO: el diagrama de actividades que rige el trámite y sus nodos.
3. EXTRACTO DEL DOCUMENTO que están revisando.

TU TRABAJO:
- Detectar inconsistencias entre el documento y los datos del trámite (montos, nombres, fechas, CI).
- Verificar si el trámite cumple los requisitos del nodo actual del flujo antes de avanzar.
- Explicar en qué paso del flujo está el problema y qué unidad/funcionario debe corregirlo.
- Sugerir la acción concreta: aprobar, observar, solicitar corrección al cliente, o devolver al nodo anterior.

REGLAS:
- Responde SIEMPRE en español, conciso y accionable.
- Cita los datos específicos del contexto (no inventes datos que no estén).
- Si falta información en el contexto, dilo explícitamente.

Responde en formato JSON:
{ "respuesta": "Tu análisis y recomendación aquí" }"""


# ============================================================
# AYUDAS PREDEFINIDAS POR ROL (Modo local)
# ============================================================

AYUDAS_POR_ROL: Dict[str, Dict[str, str]] = {
    "administrador": {
        "default": (
            "👋 ¡Bienvenido, Administrador! Puede gestionar las políticas de negocio, "
            "administrar usuarios y roles, y monitorear el rendimiento general del sistema."
        ),
        "politicas": (
            "📋 Para gestionar políticas de negocio:\n"
            "1. Vaya a 'Políticas de Negocio' en el menú lateral.\n"
            "2. Solo puede editar políticas que NO estén en ejecución.\n"
            "3. Use el editor visual para diseñar el diagrama de actividades."
        ),
        "usuarios": (
            "👥 Para gestionar usuarios:\n"
            "1. Vaya a 'Administración > Usuarios'.\n"
            "2. Asigne roles: Diseñador, Funcionario o Cliente.\n"
            "3. Configure los permisos según el departamento."
        ),
        "monitoreo": (
            "📊 Para monitorear el sistema:\n"
            "1. Revise el panel de analítica.\n"
            "2. Los cuellos de botella se marcan en rojo.\n"
            "3. Las recomendaciones de la IA aparecen automáticamente."
        ),
    },
    "disenador": {
        "default": (
            "👋 ¡Bienvenido, Diseñador! Puede crear y editar diagramas de actividad "
            "organizados en calles (swimlanes) para las políticas de negocio."
        ),
        "diagrama": (
            "🎨 Para diseñar un diagrama:\n"
            "1. Arrastre nodos desde la paleta lateral al canvas.\n"
            "2. Conecte nodos arrastrando desde los puntos de conexión.\n"
            "3. O use la IA: describa el flujo en lenguaje natural y se generará automáticamente."
        ),
        "ia": (
            "🤖 Para usar la IA en el diseño:\n"
            "1. Presione el botón 'Generar con IA'.\n"
            "2. Describa el proceso en sus propias palabras.\n"
            "3. Ejemplo: 'Crear flujo donde cliente solicita crédito, analista revisa, comité aprueba'.\n"
            "4. La IA generará el diagrama que puede editar."
        ),
        "colaborativo": (
            "👥 Diseño colaborativo:\n"
            "1. Otros diseñadores pueden editar simultáneamente.\n"
            "2. Los cambios se sincronizan en tiempo real vía WebSocket.\n"
            "3. Vea quién está editando con los cursores de colores."
        ),
    },
    "funcionario": {
        "default": (
            "👋 ¡Bienvenido, Funcionario! En su panel puede ver las tareas pendientes, "
            "ejecutar actividades y llenar formularios de los trámites asignados."
        ),
        "tareas": (
            "📋 Sus tareas pendientes:\n"
            "1. Las tareas en VERDE son las que puede ejecutar ahora.\n"
            "2. Las tareas en ROJO están retrasadas o bloqueadas.\n"
            "3. Haga clic en una tarea para ver los detalles y el formulario."
        ),
        "voz": (
            "🎤 Para usar dictado por voz:\n"
            "1. Presione el icono de micrófono en el formulario.\n"
            "2. Hable claramente describiendo la información.\n"
            "3. Ejemplo: 'El cliente Juan Pérez con CI 12345 solicita crédito de 50000 bs'.\n"
            "4. La IA rellenará los campos automáticamente."
        ),
        "formulario": (
            "📝 Para llenar formularios:\n"
            "1. Complete todos los campos requeridos (marcados con *).\n"
            "2. Use el dictado por voz para ser más productivo.\n"
            "3. Presione 'Guardar y Avanzar' para pasar al siguiente nodo."
        ),
    },
    "cliente": {
        "default": (
            "👋 ¡Bienvenido! Desde aquí puede consultar el estado de sus trámites "
            "y recibir notificaciones sobre el avance de sus solicitudes."
        ),
        "tramites": (
            "📋 Para ver el estado de sus trámites:\n"
            "1. Vaya a 'Mis Trámites' en el menú.\n"
            "2. Cada trámite muestra su estado actual y en qué departamento se encuentra.\n"
            "3. Los colores indican: 🟢 En progreso, 🟡 En espera, 🔴 Requiere atención."
        ),
        "notificaciones": (
            "🔔 Notificaciones:\n"
            "1. Recibirá notificaciones push cuando su trámite avance.\n"
            "2. Revise la campana en la esquina superior derecha.\n"
            "3. Configure sus preferencias de notificación en Ajustes."
        ),
    },
}

SUGERENCIAS_POR_ROL: Dict[str, List[str]] = {
    "administrador": [
        "Ver panel de analítica con cuellos de botella",
        "Gestionar políticas de negocio",
        "Administrar usuarios y roles",
    ],
    "disenador": [
        "Crear nuevo diagrama de actividad",
        "Usar IA para generar diagrama desde texto",
        "Editar diagrama existente",
    ],
    "funcionario": [
        "Ver tareas pendientes",
        "Usar dictado por voz para llenar formulario",
        "Revisar historial de actividades",
    ],
    "cliente": [
        "Consultar estado de trámites",
        "Ver notificaciones recientes",
        "Contactar soporte",
    ],
}


class AssistantService:
    """
    Servicio de asistente de IA contextual que guía al usuario
    según su rol y contexto actual en la aplicación.
    """

    def __init__(self):
        logger.info("AssistantService inicializado (modo IA: %s)", "API" if settings.is_api_mode else "LOCAL")

    @property
    def _client(self) -> OpenAI | None:
        """Cliente OpenAI según el modo IA actual (consultado en cada llamada para permitir alternar en runtime)."""
        if not settings.is_api_mode:
            return None
        if settings.openai_base_url:
            return OpenAI(api_key=settings.openai_api_key, base_url=settings.openai_base_url)
        return OpenAI(api_key=settings.openai_api_key)

    # --------------------------------------------------------
    # MÉTODO PRINCIPAL
    # --------------------------------------------------------

    async def obtener_ayuda(
        self,
        mensaje: str,
        rol_usuario: str = "funcionario",
        contexto_actual: Optional[str] = None,
    ) -> Dict[str, any]:
        """
        Genera una respuesta de ayuda personalizada al usuario.

        Args:
            mensaje: Consulta del usuario.
            rol_usuario: Rol actual del usuario.
            contexto_actual: Pantalla o acción actual del usuario.

        Returns:
            Diccionario con respuesta y sugerencias.
        """
        rol = rol_usuario.lower().strip()

        if self._client:
            try:
                return await self._ayuda_con_gpt(mensaje, rol, contexto_actual)
            except OpenAIError as error:
                logger.warning("Error con GPT para asistente, usando modo local: %s", error)

        return self._ayuda_local(mensaje, rol, contexto_actual)

    # --------------------------------------------------------
    # REVISIÓN COLABORATIVA (funcionario ↔ funcionario)
    # --------------------------------------------------------

    async def revision_colaborativa(self, mensaje: str, contexto: str) -> str:
        """
        Analiza el trámite + política + documento para ayudar a los
        funcionarios a resolver observaciones en el editor colaborativo.
        """
        if self._client:
            try:
                prompt_usuario = (
                    f"=== CONTEXTO ===\n{contexto[:12000]}\n\n"
                    f"=== CONSULTA DEL FUNCIONARIO ===\n{mensaje}"
                )
                response = await asyncio.to_thread(
                    self._client.chat.completions.create,
                    model=settings.openai_model,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT_COLABORATIVO},
                        {"role": "user", "content": prompt_usuario},
                    ],
                    temperature=0.3,
                    max_tokens=800,
                    response_format={"type": "json_object"},
                )
                contenido = response.choices[0].message.content or ""
                resultado = json.loads(contenido)
                return resultado.get("respuesta", "No pude analizar el contexto.")
            except OpenAIError as error:
                logger.warning("Error con GPT en revisión colaborativa: %s", error)

        # Modo local sin API
        return (
            "🤖 Asistente en modo local (sin API de IA configurada).\n"
            "Revisa manualmente: 1) que los datos del documento coincidan con las "
            "respuestas del trámite, 2) que el nodo actual del flujo permita avanzar, "
            "3) el historial para ver qué unidad hizo la última modificación."
        )

    # --------------------------------------------------------
    # AYUDA CON GPT
    # --------------------------------------------------------

    async def _ayuda_con_gpt(
        self,
        mensaje: str,
        rol_usuario: str,
        contexto_actual: Optional[str],
    ) -> Dict[str, any]:
        """Genera ayuda contextual usando el LLM configurado."""
        assert self._client is not None
        contexto_info = f"\nPantalla actual: {contexto_actual}" if contexto_actual else ""

        prompt_usuario = (
            f"Rol del usuario: {rol_usuario}{contexto_info}\n"
            f"Consulta: {mensaje}"
        )

        response = await asyncio.to_thread(
            self._client.chat.completions.create,
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_ASISTENTE},
                {"role": "user", "content": prompt_usuario},
            ],
            temperature=0.5,
            max_tokens=500,
            response_format={"type": "json_object"},
        )

        contenido = response.choices[0].message.content or ""
        resultado = json.loads(contenido)

        return {
            "respuesta": resultado.get("respuesta", "No pude procesar tu consulta."),
            "sugerencias": resultado.get("sugerencias", []),
        }

    # --------------------------------------------------------
    # AYUDA LOCAL (Sin API)
    # --------------------------------------------------------

    def _ayuda_local(
        self,
        mensaje: str,
        rol_usuario: str,
        contexto_actual: Optional[str],
    ) -> Dict[str, any]:
        """Genera ayuda usando ayudas predefinidas por rol."""
        ayudas_rol = AYUDAS_POR_ROL.get(rol_usuario, AYUDAS_POR_ROL["funcionario"])
        sugerencias = SUGERENCIAS_POR_ROL.get(rol_usuario, SUGERENCIAS_POR_ROL["funcionario"])

        # Buscar ayuda contextual según palabras clave del mensaje
        mensaje_lower = mensaje.lower()
        respuesta = ayudas_rol.get("default", "")

        for clave, ayuda in ayudas_rol.items():
            if clave != "default" and clave in mensaje_lower:
                respuesta = ayuda
                break

        # Buscar por contexto actual
        if contexto_actual:
            contexto_lower = contexto_actual.lower()
            for clave, ayuda in ayudas_rol.items():
                if clave != "default" and clave in contexto_lower:
                    respuesta = ayuda
                    break

        return {
            "respuesta": respuesta,
            "sugerencias": sugerencias,
        }
