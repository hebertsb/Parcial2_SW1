"""
NexusFlow AI - Servicio de Procesamiento de Lenguaje Natural
=============================================================
Genera diagramas de actividad (swimlanes/calles) a partir de
descripciones en lenguaje natural.

Dos modos de operación:
  - API: Usa LLM configurado (Groq/Llama o compatible OpenAI) para interpretación avanzada
  - Local: Usa plantillas predefinidas con detección de intenciones
"""

import asyncio
import json
import logging
import re
from typing import Dict, Any, List

from openai import OpenAI, OpenAIError

from ..config import settings

logger = logging.getLogger(__name__)


# ============================================================
# PROMPT DEL SISTEMA PARA EL LLM (Groq/Llama o compatible)
# ============================================================

SYSTEM_PROMPT_DIAGRAMA = """Eres un experto en diseño de procesos de negocio y diagramas de actividad UML organizados en calles (swimlanes).

Tu trabajo es interpretar descripciones en lenguaje natural y generar un diagrama de actividad COMPLETO y DETALLADO en formato JSON.

REGLAS CRÍTICAS — DEBES CUMPLIRLAS TODAS:
1. GENERA TODOS los pasos mencionados en la descripción. Si menciona "cliente presenta documentos", "analista valida", "comité evalúa", "aprueba o rechaza" → crea un nodo TASK para CADA acción mencionada.
2. NO simplifiques ni omitas pasos. Si la descripción tiene 5 acciones → genera 5 nodos TASK mínimo.
3. Cada departamento/rol mencionado = una calle (unidad) diferente.
4. Cada nodo tiene: id (n1, n2...), nombre, tipo, unidad, descripcion y campos.
5. Tipos válidos: NODO_INICIO, TASK, GATEWAY, NODO_FIN.
6. NODO_INICIO, GATEWAY y NODO_FIN siempre tienen "campos": [].
7. Cada TASK tiene entre 3 y 6 campos de formulario relevantes al contexto de esa tarea.
8. Cada enlace tiene: from, to, y opcionalmente condicion ("Sí" o "No").
9. Los GATEWAY son decisiones (nombre con ¿?) con bifurcación Sí/No obligatoria.
10. Exactamente UN NODO_INICIO y UN NODO_FIN.
11. Genera nombres descriptivos y profesionales en español.
12. Para un proceso con "aprueba o rechaza" SIEMPRE incluye un GATEWAY con dos ramas: una para aprobación y otra para rechazo, cada una con su TASK correspondiente.

TIPOS DE CAMPO DISPONIBLES:
- "texto": entrada de texto corto (nombres, CI, códigos, teléfonos)
- "textarea": texto largo (observaciones, descripciones, justificaciones)
- "numero": valores numéricos (montos, cantidades, plazos, porcentajes)
- "fecha": selector de fecha
- "archivo": carga de documento adjunto (PDF, imagen, Word)
- "select": lista desplegable — DEBE incluir "opciones": ["op1", "op2", ...]
- "checkbox": casilla de verificación (confirmaciones, firmas digitales)

ESTRUCTURA DE UN CAMPO:
{
  "id": "c1",
  "nombre": "Nombre descriptivo del campo",
  "tipo": "texto|textarea|numero|fecha|archivo|select|checkbox",
  "requerido": true|false,
  "placeholder": "Texto de ayuda para el usuario",
  "opciones": ["Solo para tipo select"]
}

FORMATO DE RESPUESTA (JSON puro, sin markdown):
{
  "nombre": "Nombre del Proceso",
  "descripcion": "Descripción breve del flujo",
  "nodos": [
    {
      "id": "n1",
      "nombre": "Inicio",
      "tipo": "NODO_INICIO",
      "unidad": "CLIENTE",
      "descripcion": "Punto de inicio del proceso",
      "campos": []
    },
    {
      "id": "n2",
      "nombre": "Validar Documentación",
      "tipo": "TASK",
      "unidad": "ANALISIS",
      "descripcion": "El analista verifica los documentos presentados",
      "campos": [
        {"id": "c1", "nombre": "Número de CI", "tipo": "texto", "requerido": true, "placeholder": "Ej: 12345678"},
        {"id": "c2", "nombre": "Documento adjunto", "tipo": "archivo", "requerido": true, "placeholder": ""},
        {"id": "c3", "nombre": "Resultado", "tipo": "select", "requerido": true, "placeholder": "", "opciones": ["Aprobado", "Rechazado", "Pendiente"]},
        {"id": "c4", "nombre": "Observaciones", "tipo": "textarea", "requerido": false, "placeholder": "Observaciones adicionales"}
      ]
    },
    {
      "id": "n3",
      "nombre": "¿Documentos Válidos?",
      "tipo": "GATEWAY",
      "unidad": "ANALISIS",
      "descripcion": "Decisión basada en resultado de validación",
      "campos": []
    },
    {
      "id": "n4",
      "nombre": "Fin del Proceso",
      "tipo": "NODO_FIN",
      "unidad": "SISTEMA",
      "descripcion": "Fin del proceso",
      "campos": []
    }
  ],
  "enlaces": [
    {"from": "n1", "to": "n2"},
    {"from": "n2", "to": "n3"},
    {"from": "n3", "to": "n4", "condicion": "Sí"},
    {"from": "n3", "to": "n2", "condicion": "No"}
  ]
}

Responde ÚNICAMENTE con el JSON, sin texto adicional ni bloques de código."""


# ============================================================
# PLANTILLAS LOCALES (Modo sin API)
# ============================================================

PLANTILLAS_WORKFLOW: Dict[str, Dict[str, Any]] = {
    "credito": {
        "nombre": "Solicitud de Crédito",
        "descripcion": "Flujo de solicitud, evaluación y aprobación de crédito financiero.",
        "nodos": [
            {"id": "n1", "nombre": "Solicitar Crédito", "tipo": "NODO_INICIO", "unidad": "CLIENTE", "descripcion": "El cliente inicia la solicitud de crédito", "campos": []},
            {"id": "n2", "nombre": "Validar Documentación", "tipo": "TASK", "unidad": "ANALISIS", "descripcion": "El analista verifica los documentos presentados", "campos": [
                {"id": "c1", "nombre": "Número de CI", "tipo": "texto", "requerido": True, "placeholder": "Ej: 12345678"},
                {"id": "c2", "nombre": "Documento adjunto", "tipo": "archivo", "requerido": True, "placeholder": ""},
                {"id": "c3", "nombre": "Resultado de validación", "tipo": "select", "requerido": True, "placeholder": "", "opciones": ["Documentos completos", "Documentos incompletos", "Documentos inválidos"]},
                {"id": "c4", "nombre": "Observaciones", "tipo": "textarea", "requerido": False, "placeholder": "Detalle observaciones sobre los documentos"},
            ]},
            {"id": "n3", "nombre": "¿Documentos Válidos?", "tipo": "GATEWAY", "unidad": "ANALISIS", "descripcion": "Decisión basada en resultado de validación documental", "campos": []},
            {"id": "n4", "nombre": "Evaluar Capacidad de Pago", "tipo": "TASK", "unidad": "RIESGO", "descripcion": "El área de riesgo evalúa la capacidad financiera del solicitante", "campos": [
                {"id": "c1", "nombre": "Monto solicitado (Bs)", "tipo": "numero", "requerido": True, "placeholder": "Ej: 50000"},
                {"id": "c2", "nombre": "Plazo en meses", "tipo": "numero", "requerido": True, "placeholder": "Ej: 36"},
                {"id": "c3", "nombre": "Ingresos mensuales (Bs)", "tipo": "numero", "requerido": True, "placeholder": "Ej: 8000"},
                {"id": "c4", "nombre": "Deudas actuales (Bs)", "tipo": "numero", "requerido": False, "placeholder": "0 si no tiene deudas"},
                {"id": "c5", "nombre": "Score de riesgo", "tipo": "select", "requerido": True, "placeholder": "", "opciones": ["Bajo", "Medio", "Alto", "Muy alto"]},
                {"id": "c6", "nombre": "Observaciones de riesgo", "tipo": "textarea", "requerido": False, "placeholder": "Justificación del score asignado"},
            ]},
            {"id": "n5", "nombre": "¿Aprueba Riesgo?", "tipo": "GATEWAY", "unidad": "RIESGO", "descripcion": "Decisión basada en score de riesgo y capacidad de pago", "campos": []},
            {"id": "n6", "nombre": "Aprobar Crédito", "tipo": "TASK", "unidad": "COMITE", "descripcion": "El comité formaliza la aprobación del crédito", "campos": [
                {"id": "c1", "nombre": "Monto aprobado (Bs)", "tipo": "numero", "requerido": True, "placeholder": "Puede diferir del solicitado"},
                {"id": "c2", "nombre": "Tasa de interés (%)", "tipo": "numero", "requerido": True, "placeholder": "Ej: 12.5"},
                {"id": "c3", "nombre": "Condiciones especiales", "tipo": "textarea", "requerido": False, "placeholder": "Condiciones adicionales del crédito"},
                {"id": "c4", "nombre": "Confirmación de aprobación", "tipo": "checkbox", "requerido": True, "placeholder": ""},
            ]},
            {"id": "n7", "nombre": "Rechazar Solicitud", "tipo": "TASK", "unidad": "COMITE", "descripcion": "El comité registra el rechazo con justificación", "campos": [
                {"id": "c1", "nombre": "Motivo de rechazo", "tipo": "select", "requerido": True, "placeholder": "", "opciones": ["Capacidad de pago insuficiente", "Sin garantías", "Documentación incompleta", "Score de riesgo muy alto"]},
                {"id": "c2", "nombre": "Observaciones", "tipo": "textarea", "requerido": True, "placeholder": "Explique el motivo del rechazo en detalle"},
            ]},
            {"id": "n8", "nombre": "Notificar Resultado", "tipo": "TASK", "unidad": "SISTEMA", "descripcion": "El sistema notifica al cliente sobre el resultado", "campos": [
                {"id": "c1", "nombre": "Canal de notificación", "tipo": "select", "requerido": True, "placeholder": "", "opciones": ["Email", "SMS", "Carta física"]},
                {"id": "c2", "nombre": "Mensaje personalizado", "tipo": "textarea", "requerido": False, "placeholder": "Mensaje adicional para el cliente"},
            ]},
            {"id": "n9", "nombre": "Fin del Proceso", "tipo": "NODO_FIN", "unidad": "SISTEMA", "descripcion": "Proceso de solicitud de crédito finalizado", "campos": []},
        ],
        "enlaces": [
            {"from": "n1", "to": "n2"},
            {"from": "n2", "to": "n3"},
            {"from": "n3", "to": "n2", "condicion": "No"},
            {"from": "n3", "to": "n4", "condicion": "Sí"},
            {"from": "n4", "to": "n5"},
            {"from": "n5", "to": "n6", "condicion": "Sí"},
            {"from": "n5", "to": "n7", "condicion": "No"},
            {"from": "n6", "to": "n8"},
            {"from": "n7", "to": "n8"},
            {"from": "n8", "to": "n9"},
        ],
    },
    "vacaciones": {
        "nombre": "Solicitud de Vacaciones",
        "descripcion": "Flujo de solicitud y aprobación de vacaciones de empleados.",
        "nodos": [
            {"id": "n1", "nombre": "Solicitar Vacaciones", "tipo": "NODO_INICIO", "unidad": "EMPLEADO", "descripcion": "El empleado inicia la solicitud de vacaciones", "campos": []},
            {"id": "n2", "nombre": "Revisar Solicitud", "tipo": "TASK", "unidad": "JEFE_DIRECTO", "descripcion": "El jefe directo revisa las fechas y disponibilidad", "campos": [
                {"id": "c1", "nombre": "Fecha de inicio", "tipo": "fecha", "requerido": True, "placeholder": ""},
                {"id": "c2", "nombre": "Fecha de fin", "tipo": "fecha", "requerido": True, "placeholder": ""},
                {"id": "c3", "nombre": "Días solicitados", "tipo": "numero", "requerido": True, "placeholder": "Ej: 15"},
                {"id": "c4", "nombre": "Motivo / Destino", "tipo": "textarea", "requerido": False, "placeholder": "Opcional: destino o motivo del descanso"},
            ]},
            {"id": "n3", "nombre": "¿Días Disponibles?", "tipo": "GATEWAY", "unidad": "JEFE_DIRECTO", "descripcion": "Verificación de días acumulados disponibles", "campos": []},
            {"id": "n4", "nombre": "Validar en RRHH", "tipo": "TASK", "unidad": "RRHH", "descripcion": "RRHH valida disponibilidad real según sistema", "campos": [
                {"id": "c1", "nombre": "Días disponibles en sistema", "tipo": "numero", "requerido": True, "placeholder": "Según registro oficial"},
                {"id": "c2", "nombre": "Período laboral cubierto", "tipo": "texto", "requerido": False, "placeholder": "Ej: Ene 2025 - Dic 2025"},
                {"id": "c3", "nombre": "Observaciones RRHH", "tipo": "textarea", "requerido": False, "placeholder": "Notas adicionales de RRHH"},
            ]},
            {"id": "n5", "nombre": "Aprobar Vacaciones", "tipo": "TASK", "unidad": "RRHH", "descripcion": "RRHH formaliza la aprobación y actualiza el sistema", "campos": [
                {"id": "c1", "nombre": "Días aprobados", "tipo": "numero", "requerido": True, "placeholder": "Puede ser menor a los solicitados"},
                {"id": "c2", "nombre": "Confirmación de aprobación", "tipo": "checkbox", "requerido": True, "placeholder": ""},
                {"id": "c3", "nombre": "Notas adicionales", "tipo": "textarea", "requerido": False, "placeholder": "Condiciones o restricciones"},
            ]},
            {"id": "n6", "nombre": "Rechazar Solicitud", "tipo": "TASK", "unidad": "JEFE_DIRECTO", "descripcion": "El jefe registra el rechazo con motivo", "campos": [
                {"id": "c1", "nombre": "Motivo de rechazo", "tipo": "select", "requerido": True, "placeholder": "", "opciones": ["Sin días disponibles", "Período no conveniente para el área", "Cobertura insuficiente", "Solicitud incompleta"]},
                {"id": "c2", "nombre": "Observaciones", "tipo": "textarea", "requerido": True, "placeholder": "Explique el motivo del rechazo"},
            ]},
            {"id": "n7", "nombre": "Notificar Empleado", "tipo": "TASK", "unidad": "SISTEMA", "descripcion": "El sistema notifica el resultado al empleado", "campos": [
                {"id": "c1", "nombre": "Canal de notificación", "tipo": "select", "requerido": True, "placeholder": "", "opciones": ["Email corporativo", "Portal interno"]},
                {"id": "c2", "nombre": "Mensaje adicional", "tipo": "textarea", "requerido": False, "placeholder": "Mensaje personalizado al empleado"},
            ]},
            {"id": "n8", "nombre": "Fin del Proceso", "tipo": "NODO_FIN", "unidad": "SISTEMA", "descripcion": "Proceso de solicitud de vacaciones finalizado", "campos": []},
        ],
        "enlaces": [
            {"from": "n1", "to": "n2"},
            {"from": "n2", "to": "n3"},
            {"from": "n3", "to": "n4", "condicion": "Sí"},
            {"from": "n3", "to": "n6", "condicion": "No"},
            {"from": "n4", "to": "n5"},
            {"from": "n5", "to": "n7"},
            {"from": "n6", "to": "n7"},
            {"from": "n7", "to": "n8"},
        ],
    },
    "compra": {
        "nombre": "Orden de Compra",
        "descripcion": "Flujo de adquisición de insumos con aprobación presupuestaria.",
        "nodos": [
            {"id": "n1", "nombre": "Solicitar Compra", "tipo": "NODO_INICIO", "unidad": "SOLICITANTE", "descripcion": "El área solicitante inicia la orden de compra", "campos": []},
            {"id": "n2", "nombre": "Cotizar Proveedores", "tipo": "TASK", "unidad": "COMPRAS", "descripcion": "Compras obtiene cotizaciones de al menos 3 proveedores", "campos": [
                {"id": "c1", "nombre": "Proveedor 1", "tipo": "texto", "requerido": True, "placeholder": "Nombre del proveedor"},
                {"id": "c2", "nombre": "Precio cotizado 1 (Bs)", "tipo": "numero", "requerido": True, "placeholder": "Monto de la cotización"},
                {"id": "c3", "nombre": "Proveedor 2", "tipo": "texto", "requerido": False, "placeholder": "Nombre del proveedor"},
                {"id": "c4", "nombre": "Precio cotizado 2 (Bs)", "tipo": "numero", "requerido": False, "placeholder": "Monto de la cotización"},
                {"id": "c5", "nombre": "Documento de cotización", "tipo": "archivo", "requerido": False, "placeholder": ""},
            ]},
            {"id": "n3", "nombre": "Evaluar Cotizaciones", "tipo": "TASK", "unidad": "COMPRAS", "descripcion": "Compras selecciona la mejor oferta y justifica la elección", "campos": [
                {"id": "c1", "nombre": "Proveedor seleccionado", "tipo": "texto", "requerido": True, "placeholder": "Nombre del proveedor elegido"},
                {"id": "c2", "nombre": "Precio final (Bs)", "tipo": "numero", "requerido": True, "placeholder": "Monto total de la compra"},
                {"id": "c3", "nombre": "Justificación de selección", "tipo": "textarea", "requerido": True, "placeholder": "Explique por qué se eligió este proveedor"},
            ]},
            {"id": "n4", "nombre": "¿Presupuesto Disponible?", "tipo": "GATEWAY", "unidad": "FINANZAS", "descripcion": "Finanzas verifica disponibilidad presupuestaria", "campos": []},
            {"id": "n5", "nombre": "Aprobar Orden de Compra", "tipo": "TASK", "unidad": "GERENCIA", "descripcion": "Gerencia aprueba y firma la orden de compra", "campos": [
                {"id": "c1", "nombre": "Monto aprobado (Bs)", "tipo": "numero", "requerido": True, "placeholder": "Monto final aprobado"},
                {"id": "c2", "nombre": "Código presupuestario", "tipo": "texto", "requerido": True, "placeholder": "Código del centro de costo"},
                {"id": "c3", "nombre": "Confirmación de aprobación", "tipo": "checkbox", "requerido": True, "placeholder": ""},
            ]},
            {"id": "n6", "nombre": "Rechazar por Presupuesto", "tipo": "TASK", "unidad": "FINANZAS", "descripcion": "Finanzas registra el rechazo por falta de presupuesto", "campos": [
                {"id": "c1", "nombre": "Motivo de rechazo", "tipo": "select", "requerido": True, "placeholder": "", "opciones": ["Presupuesto insuficiente", "Monto excede límite autorizado", "Período presupuestario cerrado"]},
                {"id": "c2", "nombre": "Observaciones", "tipo": "textarea", "requerido": True, "placeholder": "Detalle el motivo del rechazo"},
            ]},
            {"id": "n7", "nombre": "Emitir Orden de Compra", "tipo": "TASK", "unidad": "COMPRAS", "descripcion": "Compras emite el documento oficial de orden de compra", "campos": [
                {"id": "c1", "nombre": "Número de orden", "tipo": "texto", "requerido": True, "placeholder": "Ej: OC-2026-0042"},
                {"id": "c2", "nombre": "Fecha de entrega esperada", "tipo": "fecha", "requerido": True, "placeholder": ""},
                {"id": "c3", "nombre": "Documento de orden", "tipo": "archivo", "requerido": False, "placeholder": "PDF de la orden de compra"},
            ]},
            {"id": "n8", "nombre": "Recibir Mercadería", "tipo": "TASK", "unidad": "ALMACEN", "descripcion": "Almacén registra la recepción y verifica el estado", "campos": [
                {"id": "c1", "nombre": "Cantidad recibida", "tipo": "numero", "requerido": True, "placeholder": "Unidades recibidas"},
                {"id": "c2", "nombre": "Estado de la mercadería", "tipo": "select", "requerido": True, "placeholder": "", "opciones": ["Completo y en buen estado", "Parcial", "Con daños", "No conforme"]},
                {"id": "c3", "nombre": "Observaciones de recepción", "tipo": "textarea", "requerido": False, "placeholder": "Notas sobre el estado recibido"},
            ]},
            {"id": "n9", "nombre": "Notificar Resultado", "tipo": "TASK", "unidad": "SISTEMA", "descripcion": "El sistema notifica a los interesados el resultado", "campos": [
                {"id": "c1", "nombre": "Canal de notificación", "tipo": "select", "requerido": True, "placeholder": "", "opciones": ["Email", "Portal interno"]},
                {"id": "c2", "nombre": "Mensaje", "tipo": "textarea", "requerido": False, "placeholder": "Mensaje adicional"},
            ]},
            {"id": "n10", "nombre": "Fin del Proceso", "tipo": "NODO_FIN", "unidad": "SISTEMA", "descripcion": "Proceso de orden de compra finalizado", "campos": []},
        ],
        "enlaces": [
            {"from": "n1", "to": "n2"},
            {"from": "n2", "to": "n3"},
            {"from": "n3", "to": "n4"},
            {"from": "n4", "to": "n5", "condicion": "Sí"},
            {"from": "n4", "to": "n6", "condicion": "No"},
            {"from": "n5", "to": "n7"},
            {"from": "n7", "to": "n8"},
            {"from": "n8", "to": "n9"},
            {"from": "n6", "to": "n9"},
            {"from": "n9", "to": "n10"},
        ],
    },
    "instalacion": {
        "nombre": "Solicitud de Instalación de Servicio",
        "descripcion": "Flujo de instalación de servicio: recepción, verificación técnica, facturación y legal.",
        "nodos": [
            {"id": "n1", "nombre": "Recibir Solicitud", "tipo": "NODO_INICIO", "unidad": "CALL_CENTER", "descripcion": "El call center recibe la solicitud del cliente", "campos": []},
            {"id": "n2", "nombre": "Registrar Datos del Cliente", "tipo": "TASK", "unidad": "CALL_CENTER", "descripcion": "Se registran todos los datos del cliente solicitante", "campos": [
                {"id": "c1", "nombre": "Nombre completo", "tipo": "texto", "requerido": True, "placeholder": "Nombre y apellidos del cliente"},
                {"id": "c2", "nombre": "CI / NIT", "tipo": "texto", "requerido": True, "placeholder": "Número de identificación"},
                {"id": "c3", "nombre": "Dirección de instalación", "tipo": "texto", "requerido": True, "placeholder": "Dirección completa"},
                {"id": "c4", "nombre": "Teléfono de contacto", "tipo": "texto", "requerido": True, "placeholder": "Ej: 78945612"},
                {"id": "c5", "nombre": "Email", "tipo": "texto", "requerido": False, "placeholder": "correo@ejemplo.com"},
            ]},
            {"id": "n3", "nombre": "Verificar Viabilidad Técnica", "tipo": "TASK", "unidad": "TECNICO", "descripcion": "El técnico evalúa si la zona es técnicamente viable", "campos": [
                {"id": "c1", "nombre": "Zona / Sector", "tipo": "texto", "requerido": True, "placeholder": "Nombre del sector o zona"},
                {"id": "c2", "nombre": "Distancia al nodo más cercano (km)", "tipo": "numero", "requerido": True, "placeholder": "Ej: 1.5"},
                {"id": "c3", "nombre": "Tipo de zona", "tipo": "select", "requerido": True, "placeholder": "", "opciones": ["Urbano", "Periurbano", "Rural"]},
                {"id": "c4", "nombre": "Observaciones técnicas", "tipo": "textarea", "requerido": False, "placeholder": "Condiciones del terreno u obstáculos"},
            ]},
            {"id": "n4", "nombre": "¿Zona Viable?", "tipo": "GATEWAY", "unidad": "TECNICO", "descripcion": "Decisión basada en viabilidad técnica de la zona", "campos": []},
            {"id": "n5", "nombre": "Elaborar Informe Técnico", "tipo": "TASK", "unidad": "TECNICO", "descripcion": "El técnico elabora el informe con costos y tiempos estimados", "campos": [
                {"id": "c1", "nombre": "Tipo de instalación", "tipo": "select", "requerido": True, "placeholder": "", "opciones": ["Fibra óptica", "Cable coaxial", "Inalámbrico"]},
                {"id": "c2", "nombre": "Costo estimado (Bs)", "tipo": "numero", "requerido": True, "placeholder": "Costo total de instalación"},
                {"id": "c3", "nombre": "Tiempo estimado (días)", "tipo": "numero", "requerido": True, "placeholder": "Días hábiles para completar"},
                {"id": "c4", "nombre": "Informe técnico", "tipo": "archivo", "requerido": True, "placeholder": "PDF del informe técnico"},
            ]},
            {"id": "n6", "nombre": "Generar Facturación", "tipo": "TASK", "unidad": "FACTURACION", "descripcion": "Facturación genera el documento de cobro al cliente", "campos": [
                {"id": "c1", "nombre": "Monto de instalación (Bs)", "tipo": "numero", "requerido": True, "placeholder": "Monto a cobrar"},
                {"id": "c2", "nombre": "Plan contratado", "tipo": "select", "requerido": True, "placeholder": "", "opciones": ["Básico", "Estándar", "Premium"]},
                {"id": "c3", "nombre": "Factura generada", "tipo": "archivo", "requerido": False, "placeholder": "PDF de la factura"},
            ]},
            {"id": "n7", "nombre": "Revisión Legal", "tipo": "TASK", "unidad": "LEGAL", "descripcion": "Legal revisa y formaliza el contrato de servicio", "campos": [
                {"id": "c1", "nombre": "Contrato firmado", "tipo": "archivo", "requerido": True, "placeholder": "PDF del contrato firmado"},
                {"id": "c2", "nombre": "Conformidad legal", "tipo": "checkbox", "requerido": True, "placeholder": ""},
                {"id": "c3", "nombre": "Observaciones legales", "tipo": "textarea", "requerido": False, "placeholder": "Notas sobre cláusulas especiales"},
            ]},
            {"id": "n8", "nombre": "Preparar Equipos", "tipo": "TASK", "unidad": "ALMACEN", "descripcion": "Almacén prepara y registra la salida de equipos", "campos": [
                {"id": "c1", "nombre": "Equipos requeridos", "tipo": "textarea", "requerido": True, "placeholder": "Lista de equipos a despachar"},
                {"id": "c2", "nombre": "Cantidad total de equipos", "tipo": "numero", "requerido": True, "placeholder": "Número de unidades"},
                {"id": "c3", "nombre": "Código de salida de almacén", "tipo": "texto", "requerido": True, "placeholder": "Ej: SAL-2026-0098"},
            ]},
            {"id": "n9", "nombre": "Ejecutar Instalación", "tipo": "TASK", "unidad": "TECNICO", "descripcion": "El técnico realiza la instalación en sitio", "campos": [
                {"id": "c1", "nombre": "Fecha de instalación", "tipo": "fecha", "requerido": True, "placeholder": ""},
                {"id": "c2", "nombre": "Técnico responsable", "tipo": "texto", "requerido": True, "placeholder": "Nombre del técnico"},
                {"id": "c3", "nombre": "Evidencia fotográfica", "tipo": "archivo", "requerido": True, "placeholder": "Foto de la instalación completada"},
                {"id": "c4", "nombre": "Firma de conformidad del cliente", "tipo": "checkbox", "requerido": True, "placeholder": ""},
            ]},
            {"id": "n10", "nombre": "Rechazar Solicitud", "tipo": "TASK", "unidad": "CALL_CENTER", "descripcion": "Se informa al cliente el motivo del rechazo", "campos": [
                {"id": "c1", "nombre": "Motivo de rechazo", "tipo": "select", "requerido": True, "placeholder": "", "opciones": ["Zona sin cobertura", "Zona no viable técnicamente", "Solicitud cancelada por el cliente"]},
                {"id": "c2", "nombre": "Observaciones", "tipo": "textarea", "requerido": True, "placeholder": "Detalle el motivo para informar al cliente"},
            ]},
            {"id": "n11", "nombre": "Notificar al Cliente", "tipo": "TASK", "unidad": "SISTEMA", "descripcion": "El sistema notifica el resultado al cliente", "campos": [
                {"id": "c1", "nombre": "Canal de notificación", "tipo": "select", "requerido": True, "placeholder": "", "opciones": ["Email", "SMS", "Llamada telefónica"]},
                {"id": "c2", "nombre": "Mensaje al cliente", "tipo": "textarea", "requerido": False, "placeholder": "Mensaje personalizado"},
            ]},
            {"id": "n12", "nombre": "Fin del Proceso", "tipo": "NODO_FIN", "unidad": "SISTEMA", "descripcion": "Proceso de instalación finalizado", "campos": []},
        ],
        "enlaces": [
            {"from": "n1", "to": "n2"},
            {"from": "n2", "to": "n3"},
            {"from": "n3", "to": "n4"},
            {"from": "n4", "to": "n5", "condicion": "Sí"},
            {"from": "n4", "to": "n10", "condicion": "No"},
            {"from": "n5", "to": "n6"},
            {"from": "n6", "to": "n7"},
            {"from": "n7", "to": "n8"},
            {"from": "n8", "to": "n9"},
            {"from": "n9", "to": "n11"},
            {"from": "n10", "to": "n11"},
            {"from": "n11", "to": "n12"},
        ],
    },
}

# Palabras clave para detección de intención en modo local
PALABRAS_CLAVE_INTENCION: Dict[str, List[str]] = {
    "credito": ["crédito", "préstamo", "prestamo", "financiamiento", "credito", "hipoteca"],
    "vacaciones": ["vacaciones", "descanso", "permiso", "licencia", "ausencia", "feriado"],
    "compra": ["compra", "adquisición", "adquisicion", "proveedor", "insumo", "cotización", "orden"],
    "instalacion": ["instalación", "instalacion", "servicio", "técnico", "tecnico", "call center"],
    "aprobacion": ["aprobar", "autorizar", "validar", "revisar", "aprobación"],
}


class NLPService:
    """
    Servicio de NLP para generación de diagramas de actividad.

    Soporta dos modos:
    - API: Usa OpenAI GPT para interpretación avanzada de lenguaje natural
    - Local: Usa plantillas predefinidas con detección de intenciones
    """

    def __init__(self):
        logger.info("NLPService inicializado (modo IA: %s)", "API" if settings.is_api_mode else "LOCAL")

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

    async def editar_diagrama(self, diagrama_actual: Dict[str, Any], instruccion: str) -> Dict[str, Any]:
        """
        Edita un diagrama existente según una instrucción en lenguaje natural.
        Convierte el diagrama actual (formato Angular) al formato FastAPI para contexto,
        aplica la instrucción y devuelve el diagrama modificado.
        """
        if self._client:
            try:
                return await self._editar_con_llm(diagrama_actual, instruccion)
            except OpenAIError as error:
                logger.warning("Error con LLM al editar diagrama: %s", error)
        # Fallback: devolver el diagrama sin cambios con mensaje
        logger.warning("Edición sin LLM — devolviendo diagrama sin cambios")
        nodos = self._convertir_pasos_a_nodos(diagrama_actual)
        return {
            "nombre": diagrama_actual.get("nombre", "Proceso editado"),
            "descripcion": "No se pudo aplicar la edición con IA",
            "nodos": nodos,
            "enlaces": self._convertir_relaciones_a_enlaces(diagrama_actual),
        }

    async def _editar_con_llm(self, diagrama_actual: Dict[str, Any], instruccion: str) -> Dict[str, Any]:
        """Edita el diagrama usando el LLM con el contexto del diagrama actual."""
        assert self._client is not None

        # Serializar diagrama con IDs para que el LLM pueda referenciar nodos exactos
        pasos = diagrama_actual.get("pasos", [])
        carriles = diagrama_actual.get("carriles", [])
        relaciones = diagrama_actual.get("relaciones", [])

        resumen_diagrama = f"Nombre: {diagrama_actual.get('nombre', 'Sin nombre')}\n"
        resumen_diagrama += "Carriles:\n"
        for c in carriles:
            resumen_diagrama += f"  - ID={c.get('id','')} | Nombre={c.get('nombre','')}\n"
        resumen_diagrama += "Nodos (en orden):\n"
        for p in pasos:
            tipo = p.get("tipoPaso", p.get("tipo", "TASK"))
            unidad = p.get("departamentoId", p.get("unidad", ""))
            resumen_diagrama += f"  - ID={p.get('id','')} | [{tipo}] {p.get('nombre','')} | carril={unidad}\n"
        resumen_diagrama += "Conexiones:\n"
        for r in relaciones:
            cond = f" [{r.get('condicion','')}]" if r.get('condicion') else ""
            resumen_diagrama += f"  - {r.get('padreId','from')} → {r.get('destinoId','to')}{cond}\n"

        prompt_edicion = f"""Diagrama actual:
{resumen_diagrama}

Instrucción: {instruccion}

REGLAS CRÍTICAS DE EDICIÓN:
1. AGREGAR nodo: crea el nodo Y crea el enlace que lo conecta al flujo. Si dice "después de X", conecta X→nuevo_nodo. Si el nodo anterior es NODO_FIN, inserta el nuevo nodo ANTES del NODO_FIN y conecta ultimo_nodo→nuevo→NODO_FIN.
2. ELIMINAR carril: elimina TODOS los nodos que tienen ese carril en "unidad" Y todas sus conexiones de/hacia esos nodos.
3. RENOMBRAR: cambia solo el campo nombre o unidad indicado, mantén todo lo demás igual.
4. Mantén TODOS los nodos y conexiones no mencionados exactamente como están.
5. El diagrama resultante debe ser conexo — ningún nodo puede quedar suelto sin conexión al flujo principal.
6. Genera el diagrama COMPLETO modificado en formato JSON."""

        response = await asyncio.to_thread(
            self._client.chat.completions.create,
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_DIAGRAMA},
                {"role": "user", "content": prompt_edicion},
            ],
            temperature=0.3,
            max_tokens=4000,
            response_format={"type": "json_object"},
        )

        contenido = response.choices[0].message.content or ""
        diagrama = json.loads(contenido)
        self._validar_diagrama(diagrama)
        logger.info("Diagrama editado exitosamente con instrucción: %s", instruccion[:60])
        return diagrama

    def _convertir_pasos_a_nodos(self, diagrama: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Convierte pasos Angular a nodos FastAPI para el fallback."""
        tipo_map = {"INICIO": "NODO_INICIO", "FIN": "NODO_FIN", "TAREA": "TASK", "GATEWAY": "GATEWAY"}
        nodos = []
        for p in diagrama.get("pasos", []):
            tipo_fa = tipo_map.get(p.get("tipoPaso", "TAREA"), "TASK")
            nodos.append({
                "id": p.get("id", ""),
                "nombre": p.get("nombre", ""),
                "tipo": tipo_fa,
                "unidad": p.get("departamentoId", "GENERAL"),
                "descripcion": p.get("descripcion", ""),
                "campos": p.get("campotipo", []) if isinstance(p.get("campotipo"), list) else [],
            })
        return nodos

    def _convertir_relaciones_a_enlaces(self, diagrama: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Convierte relaciones Angular a enlaces FastAPI para el fallback."""
        enlaces = []
        for r in diagrama.get("relaciones", []):
            enlace: Dict[str, Any] = {"from": r.get("padreId", ""), "to": r.get("destinoId", "")}
            if r.get("condicion"):
                enlace["condicion"] = r["condicion"]
            enlaces.append(enlace)
        return enlaces

    async def generar_diagrama(self, descripcion: str) -> Dict[str, Any]:
        """
        Genera un diagrama de actividad a partir de una descripción.

        Args:
            descripcion: Texto en lenguaje natural describiendo el workflow.

        Returns:
            Diccionario con nombre, nodos, enlaces y descripcion del diagrama.
        """
        if self._client:
            try:
                return await self._generar_con_llm(descripcion)
            except OpenAIError as error:
                logger.warning("Error con LLM API, usando fallback local: %s", error)
                return self._generar_con_plantillas(descripcion)
        return self._generar_con_plantillas(descripcion)

    # --------------------------------------------------------
    # GENERACIÓN CON LLM (Groq/Llama o compatible OpenAI)
    # --------------------------------------------------------

    async def _generar_con_llm(self, descripcion: str) -> Dict[str, Any]:
        """Genera diagrama usando LLM configurado (no bloquea el event loop)."""
        assert self._client is not None
        logger.info("Generando diagrama con LLM (%s) para: %s", settings.openai_model, descripcion[:80])

        # Prompt enriquecido: fuerza al LLM a enumerar TODOS los pasos antes de generar
        prompt_enriquecido = f"""Descripción del proceso: "{descripcion}"

INSTRUCCIÓN CRÍTICA: Antes de generar el JSON, analiza la descripción e identifica CADA acción, rol y decisión mencionada.

Para la descripción dada debes:
1. Identificar TODOS los actores/departamentos mencionados → una calle por cada uno
2. Identificar CADA actividad mencionada → un nodo TASK por cada una
3. Identificar CADA decisión o condición ("aprueba o rechaza", "si es válido", etc.) → un nodo GATEWAY por cada una
4. El GATEWAY siempre tiene dos salidas: condicion "Sí" y condicion "No", cada una llevando a un TASK diferente

GENERA EL DIAGRAMA COMPLETO con TODOS los nodos identificados. NO simplifiques ni omitas ninguna acción."""

        response = await asyncio.to_thread(
            self._client.chat.completions.create,
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_DIAGRAMA},
                {"role": "user", "content": prompt_enriquecido},
            ],
            temperature=0.2,
            max_tokens=4000,
            response_format={"type": "json_object"},
        )

        contenido = response.choices[0].message.content or ""
        diagrama = json.loads(contenido)

        # Validar estructura mínima
        self._validar_diagrama(diagrama)
        logger.info("Diagrama generado exitosamente: %s", diagrama.get("nombre"))
        return diagrama

    # --------------------------------------------------------
    # GENERACIÓN LOCAL CON PLANTILLAS
    # --------------------------------------------------------

    def _generar_con_plantillas(self, descripcion: str) -> Dict[str, Any]:
        """Genera diagrama usando plantillas predefinidas y detección de intención."""
        intencion = self._detectar_intencion(descripcion)
        logger.info("Intención detectada: %s", intencion)

        if intencion in PLANTILLAS_WORKFLOW:
            plantilla = PLANTILLAS_WORKFLOW[intencion].copy()
            return plantilla

        # Plantilla genérica para intenciones no reconocidas
        return {
            "nombre": "Proceso Personalizado",
            "descripcion": f"Flujo genérico generado a partir de: {descripcion[:100]}",
            "nodos": [
                {"id": "n1", "nombre": "Inicio del Proceso", "tipo": "NODO_INICIO", "unidad": "CLIENTE", "descripcion": "Punto de inicio", "campos": []},
                {"id": "n2", "nombre": "Registrar Solicitud", "tipo": "TASK", "unidad": "RECEPCION", "descripcion": "Recepción registra los datos de la solicitud", "campos": [
                    {"id": "c1", "nombre": "Nombre del solicitante", "tipo": "texto", "requerido": True, "placeholder": "Nombre completo"},
                    {"id": "c2", "nombre": "Descripción de la solicitud", "tipo": "textarea", "requerido": True, "placeholder": "Detalle de lo que solicita"},
                    {"id": "c3", "nombre": "Documento adjunto", "tipo": "archivo", "requerido": False, "placeholder": ""},
                ]},
                {"id": "n3", "nombre": "Procesar Solicitud", "tipo": "TASK", "unidad": "PROCESAMIENTO", "descripcion": "Se procesa y analiza la solicitud recibida", "campos": [
                    {"id": "c1", "nombre": "Resultado del procesamiento", "tipo": "textarea", "requerido": True, "placeholder": "Describa el resultado del análisis"},
                    {"id": "c2", "nombre": "Fecha de procesamiento", "tipo": "fecha", "requerido": True, "placeholder": ""},
                ]},
                {"id": "n4", "nombre": "Validar Información", "tipo": "TASK", "unidad": "VALIDACION", "descripcion": "Se verifica la veracidad y completitud de la información", "campos": [
                    {"id": "c1", "nombre": "Resultado de validación", "tipo": "select", "requerido": True, "placeholder": "", "opciones": ["Válido", "Inválido", "Pendiente de subsanar"]},
                    {"id": "c2", "nombre": "Observaciones", "tipo": "textarea", "requerido": False, "placeholder": "Notas sobre la validación"},
                ]},
                {"id": "n5", "nombre": "¿Validación Exitosa?", "tipo": "GATEWAY", "unidad": "VALIDACION", "descripcion": "Decisión basada en resultado de validación", "campos": []},
                {"id": "n6", "nombre": "Aprobar Solicitud", "tipo": "TASK", "unidad": "APROBACION", "descripcion": "Se formaliza la aprobación de la solicitud", "campos": [
                    {"id": "c1", "nombre": "Condiciones de aprobación", "tipo": "textarea", "requerido": False, "placeholder": "Condiciones o restricciones de la aprobación"},
                    {"id": "c2", "nombre": "Confirmación de aprobación", "tipo": "checkbox", "requerido": True, "placeholder": ""},
                ]},
                {"id": "n7", "nombre": "Rechazar Solicitud", "tipo": "TASK", "unidad": "APROBACION", "descripcion": "Se registra el rechazo con justificación", "campos": [
                    {"id": "c1", "nombre": "Motivo de rechazo", "tipo": "textarea", "requerido": True, "placeholder": "Explique el motivo del rechazo"},
                ]},
                {"id": "n8", "nombre": "Notificar Resultado", "tipo": "TASK", "unidad": "SISTEMA", "descripcion": "Se notifica al solicitante sobre el resultado", "campos": [
                    {"id": "c1", "nombre": "Canal de notificación", "tipo": "select", "requerido": True, "placeholder": "", "opciones": ["Email", "SMS", "Portal interno"]},
                    {"id": "c2", "nombre": "Mensaje", "tipo": "textarea", "requerido": False, "placeholder": "Mensaje personalizado al solicitante"},
                ]},
                {"id": "n9", "nombre": "Fin del Proceso", "tipo": "NODO_FIN", "unidad": "SISTEMA", "descripcion": "Proceso finalizado", "campos": []},
            ],
            "enlaces": [
                {"from": "n1", "to": "n2"},
                {"from": "n2", "to": "n3"},
                {"from": "n3", "to": "n4"},
                {"from": "n4", "to": "n5"},
                {"from": "n5", "to": "n6", "condicion": "Sí"},
                {"from": "n5", "to": "n7", "condicion": "No"},
                {"from": "n6", "to": "n8"},
                {"from": "n7", "to": "n8"},
                {"from": "n8", "to": "n9"},
            ],
        }

    # --------------------------------------------------------
    # EXTRACCIÓN DE ENTIDADES (Para servicio de voz)
    # --------------------------------------------------------

    def extraer_entidades(self, texto: str) -> Dict[str, Any]:
        """
        Extrae entidades relevantes del texto transcrito.

        Entidades detectadas: montos, fechas, plazos, nombres.
        """
        entidades: Dict[str, Any] = {}
        texto_lower = texto.lower()

        # Montos monetarios
        patron_monto = r'(\d+(?:[.,]\d+)?)\s*(?:bolivianos|bs|dólares|dolares|usd|\$)'
        montos = re.findall(patron_monto, texto_lower)
        if montos:
            entidades["monto"] = float(montos[0].replace(",", "."))

        # Fechas (dd/mm/yyyy o dd-mm-yyyy)
        patron_fecha = r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})'
        fechas = re.findall(patron_fecha, texto)
        if fechas:
            entidades["fecha"] = fechas[0]

        # Plazos temporales
        patron_plazo = r'(\d+)\s*(?:meses|mes|años|año|días|dia|semanas|semana)'
        plazos = re.findall(patron_plazo, texto_lower)
        if plazos:
            entidades["plazo"] = int(plazos[0])

        # Nombres de personas
        patron_nombre = r'(?:señor|señora|sr\.?|sra\.?|don|doña|cliente)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})'
        nombres = re.findall(patron_nombre, texto, re.IGNORECASE)
        if nombres:
            entidades["nombre_solicitante"] = nombres[0].strip()

        # CI / Cédula de identidad
        patron_ci = r'(?:ci|cédula|cedula|carnet)[:\s]*(\d{5,10})'
        ci_matches = re.findall(patron_ci, texto_lower)
        if ci_matches:
            entidades["ci"] = ci_matches[0]

        # Correo electrónico
        patron_email = r'[\w.+-]+@[\w-]+\.[\w.-]+'
        emails = re.findall(patron_email, texto_lower)
        if emails:
            entidades["email"] = emails[0]

        # Teléfono
        patron_telefono = r'(?:teléfono|telefono|cel|celular|número|numero)[:\s]*(\d{7,10})'
        telefonos = re.findall(patron_telefono, texto_lower)
        if telefonos:
            entidades["telefono"] = telefonos[0]

        return entidades

    # --------------------------------------------------------
    # RECOMENDACIONES ANALÍTICAS
    # --------------------------------------------------------

    def generar_recomendaciones(self, tiempos_por_nodo: Dict[str, float]) -> List[str]:
        """Genera recomendaciones basadas en tiempos de ejecución por nodo."""
        recomendaciones: List[str] = []

        # Calcular estadísticas
        if not tiempos_por_nodo:
            return ["✅ No hay datos suficientes para generar recomendaciones."]

        promedio_general = sum(tiempos_por_nodo.values()) / len(tiempos_por_nodo)

        for nodo, tiempo in sorted(tiempos_por_nodo.items(), key=lambda x: x[1], reverse=True):
            if tiempo > 72:
                recomendaciones.append(
                    f"🚨 CRÍTICO - Nodo '{nodo}': {tiempo:.1f}h promedio. "
                    f"Contratar personal adicional o automatizar tareas URGENTE."
                )
            elif tiempo > 48:
                recomendaciones.append(
                    f"⚠️ ALTO - Nodo '{nodo}': {tiempo:.1f}h promedio. "
                    f"Capacitar personal o redistribuir carga de trabajo."
                )
            elif tiempo > 24:
                recomendaciones.append(
                    f"📌 MEDIO - Nodo '{nodo}': {tiempo:.1f}h promedio. "
                    f"Monitorear de cerca y considerar mejoras."
                )

        if not recomendaciones:
            recomendaciones.append(
                f"✅ Todos los nodos operan dentro del rango normal. "
                f"Promedio general: {promedio_general:.1f}h."
            )

        return recomendaciones

    # --------------------------------------------------------
    # MÉTODOS AUXILIARES PRIVADOS
    # --------------------------------------------------------

    def _detectar_intencion(self, texto: str) -> str:
        """Detecta la intención del texto usando coincidencia de palabras clave."""
        texto_lower = texto.lower()
        mejor_coincidencia = "general"
        max_coincidencias = 0

        for intencion, palabras in PALABRAS_CLAVE_INTENCION.items():
            coincidencias = sum(1 for palabra in palabras if palabra in texto_lower)
            if coincidencias > max_coincidencias:
                max_coincidencias = coincidencias
                mejor_coincidencia = intencion

        return mejor_coincidencia

    @staticmethod
    def _validar_diagrama(diagrama: Dict[str, Any]) -> None:
        """Valida y normaliza la estructura de un diagrama generado por la IA."""
        campos_requeridos = ["nombre", "nodos", "enlaces"]
        for campo in campos_requeridos:
            if campo not in diagrama:
                raise ValueError(f"El diagrama generado no contiene el campo '{campo}'")

        if not diagrama["nodos"]:
            raise ValueError("El diagrama debe tener al menos un nodo")

        if "descripcion" not in diagrama:
            diagrama["descripcion"] = f"Diagrama de actividad: {diagrama['nombre']}"

        # Normalizar cada nodo: asegurar campos por defecto
        for nodo in diagrama["nodos"]:
            if "campos" not in nodo:
                nodo["campos"] = []
            if "descripcion" not in nodo:
                nodo["descripcion"] = nodo.get("nombre", "")
            # Normalizar cada campo del formulario
            for campo in nodo.get("campos", []):
                campo.setdefault("requerido", False)
                campo.setdefault("placeholder", "")
                campo.setdefault("opciones", [] if campo.get("tipo") != "select" else ["Opción 1", "Opción 2"])
