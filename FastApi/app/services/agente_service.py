"""
NexusFlow AI — Agente Clasificador de Políticas
===============================================
Colección MongoDB: 'Politica'
Campos reales: nombre, empresa_id, esta_activa, tipo_flujo,
               duracion_estandar_dias, esquema_workflow.pasos
"""

import logging
import re
import unicodedata
from typing import Optional
from pymongo import MongoClient

from ..config import settings

logger = logging.getLogger(__name__)


def _quitar_acentos(texto: str) -> str:
    """Normaliza texto: quita tildes/acentos, convierte ñ→n, ü→u."""
    nfkd = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def _distancia_edicion(a: str, b: str) -> int:
    """Levenshtein distance entre dos strings (Wagner-Fischer, O(n*m))."""
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    # Optimización: solo necesitamos dos filas
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        curr = [i] + [0] * len(b)
        for j, cb in enumerate(b, 1):
            curr[j] = min(
                prev[j] + 1,        # borrar
                curr[j - 1] + 1,    # insertar
                prev[j - 1] + (0 if ca == cb else 1),  # reemplazar
            )
        prev = curr
    return prev[len(b)]


def _tokens_similares(tok_a: str, tok_b: str) -> bool:
    """True si dos tokens son suficientemente similares.
    - Misma raíz sin acento → match exacto
    - Para tokens ≥5 chars: distancia ≤1
    - Para tokens ≥7 chars: distancia ≤2
    """
    if tok_a == tok_b:
        return True
    la, lb = len(tok_a), len(tok_b)
    # Diferencia de largo demasiado grande → no es el mismo concepto
    if abs(la - lb) > 2:
        return False
    dist = _distancia_edicion(tok_a, tok_b)
    if la >= 7 or lb >= 7:
        return dist <= 2
    if la >= 5 or lb >= 5:
        return dist <= 1
    return False


def _get_db():
    client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=8000)
    return client[settings.mongodb_database]


class AgenteService:
    _STOPWORDS = {
        "el", "la", "los", "las", "un", "una", "de", "del", "que",
        "para", "por", "con", "en", "y", "a", "mi", "me", "se",
        "es", "lo", "al", "como", "no", "si", "ya", "su", "le",
        "quiero", "necesito", "quisiera", "deseo", "hacer", "iniciar",
        "solicitar", "tengo", "hay", "ver", "dame", "dime", "cual",
    }
    # Versión normalizada (sin acentos) para _tokenizar
    _STOPWORDS_NORM = {_quitar_acentos(w) for w in _STOPWORDS}

    # ── Carga de políticas ──────────────────────────────────────────

    def _cargar_politicas(self, empresa_id: str) -> list:
        """Lee políticas activas + sus formularios reales desde MongoDB."""
        try:
            db = _get_db()
            query = {"empresa_id": empresa_id, "esta_activa": True}
            docs = list(db["Politica"].find(
                query,
                {"nombre": 1, "tipo_flujo": 1, "duracion_estandar_dias": 1,
                 "esta_activa": 1, "empresa_id": 1, "esquema_workflow": 1}
            ).limit(50))

            if not docs:
                # Fallback: buscar en EMP-001 si empresa_id era un alias antiguo
                docs = list(db["Politica"].find(
                    {"empresa_id": "EMP-001", "esta_activa": True},
                    {"nombre": 1, "tipo_flujo": 1, "duracion_estandar_dias": 1,
                     "esta_activa": 1, "empresa_id": 1, "esquema_workflow": 1}
                ).limit(50))

            politicas = []
            for doc in docs:
                pol_id = str(doc["_id"])
                pasos = doc.get("esquema_workflow", {}).get("pasos", [])
                nombres_pasos = [
                    p["nombre"] for p in pasos
                    if p.get("tipoPaso") not in ("INICIO", "FIN", "GATEWAY")
                    and p.get("nombre")
                ]
                form_ids = [
                    p["formularioId"] for p in pasos
                    if p.get("formularioId")
                ]
                documentos = self._cargar_documentos_formularios(db, pol_id, form_ids)

                politicas.append({
                    "id": pol_id,
                    "nombre": doc.get("nombre", "Sin nombre"),
                    "tipo_flujo": doc.get("tipo_flujo", ""),
                    "duracion_dias": doc.get("duracion_estandar_dias", 0),
                    "esta_activa": doc.get("esta_activa", True),
                    "empresa_id": doc.get("empresa_id", empresa_id),
                    "pasos": nombres_pasos,
                    "descripcion": self._generar_descripcion(doc, nombres_pasos),
                    "requisitos": documentos,
                })

            logger.info("Cargadas %d políticas para empresa '%s'", len(politicas), empresa_id)
            return politicas
        except Exception as exc:
            logger.error("Error al cargar políticas: %s", exc)
            return []

    def _cargar_documentos_formularios(self, db, politica_id: str, form_ids: list) -> list:
        """Extrae documentos requeridos de los formularios de la política.
        Busca campos tipo 'archivo' — son los documentos que el cliente debe presentar.
        También incluye datos clave (CI, dirección) de campos obligatorios.
        """
        vistos = set()
        documentos = []

        try:
            import bson
            # Busca formularios por ObjectId string (politica_id en Formulario_Nodo)
            formularios = list(db["Formulario_Nodo"].find(
                {"politica_id": politica_id},
                {"nombre_nodo": 1, "esquema_campos": 1, "_id": 0}
            ).limit(20))

            # Fallback: buscar por IDs directos si no encontró por politica_id
            if not formularios and form_ids:
                oids = []
                for fid in form_ids:
                    try:
                        oids.append(bson.ObjectId(fid))
                    except Exception:
                        pass
                if oids:
                    formularios = list(db["Formulario_Nodo"].find(
                        {"_id": {"$in": oids}},
                        {"nombre_nodo": 1, "esquema_campos": 1, "_id": 0}
                    ).limit(20))

            for form in formularios:
                for campo in form.get("esquema_campos", []):
                    titulo = (campo.get("titulo") or campo.get("etiqueta") or
                              campo.get("nombre") or "").strip()
                    tipo = campo.get("tipo", "")
                    obligatorio = campo.get("obligatorio", False)

                    # Clave de dedup: normaliza + elimina artículos comunes
                    # "Carnet de Identidad" == "Carnet Identidad" → misma clave
                    _articulos = {"de", "del", "la", "el", "los", "las", "un", "una", "y", "e"}
                    _palabras_titulo = [
                        w for w in re.findall(r"[a-z]+", _quitar_acentos(titulo.lower()))
                        if w not in _articulos
                    ]
                    clave_dedup = " ".join(sorted(_palabras_titulo))
                    if not titulo or clave_dedup in vistos:
                        continue

                    if tipo == "archivo":
                        formatos = campo.get("formatos", ".pdf, .jpg")
                        documentos.append(f"📄 {titulo} ({formatos})")
                        vistos.add(clave_dedup)
                    elif tipo in ("texto", "numero") and obligatorio:
                        # Palabras clave como palabras completas (no substring)
                        # "ci" en "solicitud" es falso positivo → usamos regex \b
                        palabras = set(re.findall(r"[a-z]+", _quitar_acentos(titulo.lower())))
                        keywords = {"ci", "carnet", "identidad", "cedula",
                                    "direccion", "domicilio", "telefono", "celular",
                                    "nit", "pasaporte", "licencia"}
                        if palabras & keywords:
                            documentos.append(f"✏️ {titulo}")
                            vistos.add(clave_dedup)

        except Exception as exc:
            logger.warning("No se pudieron cargar formularios: %s", exc)

        if not documentos:
            documentos = ["📄 Documento de identidad (CI)", "📄 Formulario de solicitud"]

        return documentos[:10]

    def _generar_descripcion(self, doc: dict, pasos: list) -> str:
        nombre = doc.get("nombre", "")
        pasos_str = ", ".join(pasos[:4]) if pasos else ""
        duracion = doc.get("duracion_estandar_dias", 0)
        texto = f"Trámite de {nombre}"
        if pasos_str:
            texto += f". Proceso: {pasos_str}"
        if duracion:
            texto += f". Duración estimada: {duracion} días hábiles"
        return texto

    # ── Clasificador principal ──────────────────────────────────────

    def clasificar(self, descripcion: str, empresa_id: str,
                   cliente_id: str = "", historial: list = None,
                   politica_contexto: str = "", paso_actual: int = -1,
                   tramite_lista_contexto: list = None,
                   tramite_id_contexto: str = "") -> dict:
        """
        Punto de entrada principal del agente.
        historial: lista de {rol: "user"|"agent", texto: str}
        politica_contexto: nombre de política del turno anterior (multi-turn)
        """
        historial = historial or []
        tramite_lista_contexto = tramite_lista_contexto or []
        politicas = self._cargar_politicas(empresa_id)

        # Selección de trámite activo por posición/nombre (cuando hay lista en contexto)
        if tramite_lista_contexto and cliente_id:
            sel = self._resolver_tramite_seleccionado(descripcion, tramite_lista_contexto)
            if sel is not None:
                return self._responder_tramite_seleccionado(
                    sel, tramite_lista_contexto, cliente_id, empresa_id)

        if not politicas:
            return {
                "politicas_candidatas": [],
                "politica_recomendada": None,
                "respuesta_agente": (
                    "No encontré políticas activas para su empresa en este momento. "
                    "Por favor contacte al administrador o intente más tarde."
                ),
                "confianza": 0.0,
                "total_politicas_revisadas": 0,
                "metodo": "sin_datos",
            }

        # Pre-check: user explicitly named a specific policy in their message.
        # This prevents IA from poisoning the context with a wrong recommendation.
        desc_n = _quitar_acentos(descripcion.lower())
        for _pol in politicas:
            _pol_n = _quitar_acentos(_pol["nombre"].lower())
            _sig = [w for w in _pol_n.split() if len(w) >= 4]
            if len(_pol_n) >= 5 and _pol_n in desc_n:
                logger.info("Política mencionada explícitamente: '%s'", _pol["nombre"])
                _r = self._responder_seguimiento(_pol)
                _r["metodo"] = "menciona_politica"
                return _r
            if len(_sig) >= 2 and all(w in desc_n for w in _sig):
                logger.info("Política mencionada por palabras: '%s'", _pol["nombre"])
                _r = self._responder_seguimiento(_pol)
                _r["metodo"] = "menciona_politica"
                return _r

        intent = self._detectar_intencion(descripcion, politica_contexto, tramite_id_contexto)
        logger.info("Intent: %s | contexto: '%s'", intent, politica_contexto)

        # Flujo completo: todos los pasos con sus campos
        if intent == "flujo_completo" and politica_contexto:
            politica = next((p for p in politicas
                             if _quitar_acentos(p["nombre"].lower()) ==
                             _quitar_acentos(politica_contexto.lower())), None)
            if not politica:
                politica = next((p for p in politicas
                                 if politica_contexto.lower() in p["nombre"].lower()), None)
            if politica:
                return self._responder_flujo_completo(politica, empresa_id)

        # Selección por número de la lista ("sobre el tramite 9")
        if intent.startswith("tramite_numero_"):
            try:
                num = int(intent.split("_")[-1])
                if 1 <= num <= len(politicas):
                    return self._responder_seguimiento(politicas[num - 1])
            except ValueError:
                pass

        # Siguiente paso del proceso — avanza secuencialmente con paso_actual
        if intent == "siguiente_paso" and politica_contexto:
            politica = next((p for p in politicas
                             if _quitar_acentos(p["nombre"].lower()) ==
                             _quitar_acentos(politica_contexto.lower())), None)
            if not politica:
                politica = next((p for p in politicas
                                 if politica_contexto.lower() in p["nombre"].lower()), None)
            if politica:
                return self._responder_siguiente_paso(politica, empresa_id, paso_actual)

        # Trámite con más tiempo activo
        if intent == "tramite_mas_antiguo" and cliente_id:
            return self._responder_tramite_mas_antiguo(cliente_id, empresa_id, politicas)

        # Historial completo del trámite en contexto
        if intent == "ver_historial_tramite" and tramite_id_contexto:
            return self._responder_historial_tramite(tramite_id_contexto, empresa_id)

        # Estado de trámites activos del cliente
        if intent == "estado_tramite" and cliente_id:
            return self._responder_estado_tramite(cliente_id, empresa_id, politicas)

        # Documentos solo del primer paso (cuando ya hay contexto de política)
        if intent == "primer_paso" and politica_contexto:
            politica = next((p for p in politicas
                             if _quitar_acentos(p["nombre"].lower()) ==
                             _quitar_acentos(politica_contexto.lower())), None)
            if not politica:
                politica = next((p for p in politicas
                                 if politica_contexto.lower() in p["nombre"].lower()), None)
            if politica:
                return self._responder_primer_paso(politica, empresa_id)

        # Listado general
        if intent == "listado":
            return self._responder_listado(descripcion, politicas)

        # HitL: cliente confirmó que quiere iniciar el trámite
        if intent == "quiere_iniciar" and politica_contexto:
            _pol = next((p for p in politicas
                         if _quitar_acentos(p["nombre"].lower()) ==
                         _quitar_acentos(politica_contexto.lower())), None) \
                or next((p for p in politicas
                         if politica_contexto.lower() in p["nombre"].lower()), None)
            if _pol:
                return self._responder_iniciar(_pol, empresa_id)

        # Seguimiento sobre política en contexto (sin IA extra)
        if intent == "seguimiento" and politica_contexto and not settings.is_api_mode:
            politica = next((p for p in politicas
                             if politica_contexto.lower() in p["nombre"].lower()), None)
            if politica:
                return self._responder_seguimiento(politica)

        # IA con historial multi-turn
        if settings.is_api_mode:
            try:
                return self._clasificar_con_ia(
                    descripcion, politicas, historial, politica_contexto, cliente_id, empresa_id
                )
            except Exception as exc:
                logger.warning("IA no disponible (%s), usando ranking local", exc)

        return self._clasificar_local(descripcion, politicas)

    # ── Detección de intención ──────────────────────────────────────

    def _detectar_intencion(self, descripcion: str, politica_contexto: str,
                             tramite_id_contexto: str = "") -> str:
        d = _quitar_acentos(descripcion.lower())

        # Historial del trámite activo en contexto
        if tramite_id_contexto and any(k in d for k in (
            "mostrame el historial", "ver historial", "historial del tramite",
            "todo el historial", "como fue avanzando", "que paso en mi tramite",
            "detalles del proceso", "mostrar historial", "el historial",
            "historial completo", "ver el historial", "mostrame historial",
        )):
            return "ver_historial_tramite"

        # Flujo completo: "dame todos los pasos", "todo el proceso con sus campos"
        if any(k in d for k in ("todos los pasos", "todo el flujo", "todo el proceso",
                                 "todos los campos", "todos los documentos de todos",
                                 "el proceso completo", "flujo completo",
                                 "que pasos tiene", "cuantos pasos tiene",
                                 "cada paso con", "los pasos con sus campos")):
            if politica_contexto:
                return "flujo_completo"

        # Selección de trámite por número: "9", "sobre el tramite 9", "el número 3", "opcion 2"
        m = re.search(r'(?:tramite|numero|opcion|el)\s*(\d+)', d) \
            or re.fullmatch(r'\s*(\d{1,2})\s*', descripcion)
        if m:
            return f"tramite_numero_{m.group(1)}"

        # "siguiente paso del proceso" → explica continuación del flujo
        if any(k in d for k in (
                "y luego", "luego que", "luego de", "siguiente paso",
                "que sigue", "que continua", "despues del primer", "despues de esto",
                "despues de enviar", "despues de completar", "que sigue despues",
                "paso siguiente", "proximo paso", "que viene despues",
                "continua el proceso", "que pasa despues",
                "que paso debo", "y despues que", "despues que paso",
                "que continuar", "que sigo", "debo continuar",
                "siguiente al primero", "cual es el segundo")):
            if politica_contexto:
                return "siguiente_paso"

        # Confirmación de inicio (HitL): solo frases EXPLÍCITAS de inicio
        # NO usar afirmativos solos ("sí", "ok", "dale") — ambiguos con otras preguntas
        if politica_contexto and any(k in d for k in (
            "si quiero iniciar", "quiero iniciar", "quiero empezar el tramite",
            "iniciar ahora", "empezar ahora",
            "vamos a iniciar", "comenzar el tramite",
            "si deseo iniciar", "iniciar el tramite", "iniciar tramite ahora",
            "quiero el tramite", "perfecto quiero iniciar", "comenzar ahora el tramite",
        )):
            return "quiere_iniciar"

        # Trámite con más tiempo activo (pregunta sobre el trámite más antiguo del cliente)
        if any(k in d for k in (
            "mas tiempo activo", "mas tiempo corriendo", "lleva mas tiempo",
            "mas viejo", "mas antiguo", "tramite mas viejo", "tramite mas antiguo",
            "cuanto tiempo lleva", "tiempo activo", "mas viejo activo",
            "mas tiempo tiene", "tiene mas tiempo",
        )):
            return "tramite_mas_antiguo"

        # Estado de trámite — frases inequívocas
        if any(k in d for k in (
            "como va mi tramite", "estado de mi tramite",
            "mi tramite activo", "en que etapa esta",
            "tramite activo", "solicitud activa", "ver mis tramites",
            "mis tramites activos", "cuantos tramites tengo",
            "tengo tramites", "ver estado", "revisar estado",
            "muestrame mis tramites", "muestra mis tramites", "mostrame mis tramites",
            "mostrar mis tramites", "mis tramites", "ver tramites",
            "quiero ver mis tramites", "listar mis tramites", "lista mis tramites",
            "que tramites tengo", "tramites que tengo", "tramites iniciados",
            "solicitudes activas", "ver solicitudes", "mis solicitudes",
            "flujo de mi tramite", "como va el flujo", "como esta mi tramite",
        )):
            return "estado_tramite"

        # Documentos para INICIAR (primer paso)
        if any(k in d for k in ("que debo presentar", "que documento", "que necesito llevar",
                                 "para iniciar", "para comenzar", "como empiezo",
                                 "primer paso", "que llevo", "que traigo", "comenzar ahora",
                                 "que necesito para iniciar", "iniciar el tramite",
                                 "documentacion necesito", "que documentos necesito")):
            if politica_contexto:
                return "primer_paso"

        if self._es_consulta_listado(descripcion):
            return "listado"

        # Seguimiento sobre política ya mencionada
        if politica_contexto and any(k in d for k in (
                "si correcto", "ese es", "ese tramite", "sobre ese",
                "ese", "eso", "este", "la misma", "el mismo", "mas detalles",
                "mas informacion", "sobre eso", "cuanto demora", "cuantos dias",
                "me explicas mas", "correcto")):
            return "seguimiento"

        return "general"

    # ── Estado de trámites activos ──────────────────────────────────

    def _responder_estado_tramite(self, cliente_id: str, empresa_id: str,
                                   politicas: list) -> dict:
        try:
            db = _get_db()
            tramites_raw = list(db["Tramite"].find(
                {"cliente_id": cliente_id},
                {"estado": 1, "politica_id": 1, "fecha_inicio": 1,
                 "semaforizacion": 1, "nodo_actual_id": 1, "historial": 1, "_id": 1}
            ).sort("fecha_inicio", -1).limit(5))

            if not tramites_raw:
                return self._sin_tramites_activos()

            # Dedup por _id (puede haber duplicados en la colección)
            vistos_ids: set = set()
            tramites_uniq = []
            for t in tramites_raw:
                tid = str(t.get("_id", ""))
                if tid not in vistos_ids:
                    vistos_ids.add(tid)
                    tramites_uniq.append(t)

            # Mapear policy._id (string) → policy.nombre
            pol_map = {str(p_doc["_id"]): p_doc.get("nombre", "?")
                       for p_doc in db["Politica"].find(
                           {"empresa_id": empresa_id}, {"nombre": 1})}

            lineas = []
            tramites_contexto = []
            for i, t in enumerate(tramites_uniq, 1):
                # Buscar nombre por politica_id del trámite (NO por _id del trámite)
                pid = str(t.get("politica_id", ""))
                pol_nombre = pol_map.get(pid, "")
                if not pol_nombre:
                    pol_nombre = next(
                        (p["nombre"] for p in politicas
                         if pid and pid.lower() in p["nombre"].lower()),
                        None
                    )
                if not pol_nombre:
                    pol_nombre = "Trámite sin nombre"

                estado = t.get("estado", "en_proceso")
                semaforo = t.get("semaforizacion", "")
                fecha = str(t.get("fecha_inicio", ""))[:10]

                etiqueta_estado = {
                    "en_proceso": "En proceso ⚙️",
                    "en_revision": "En revisión 🔍",
                    "observado": "Observado ⚠️",
                    "rechazado": "Rechazado ❌",
                    "finalizado": "Finalizado ✅",
                }.get(estado, estado)

                semaforo_icon = {"Rojo": "🔴", "Amarillo": "🟡", "Verde": "🟢"}.get(semaforo, "")
                lineas.append(
                    f"{i}. **{pol_nombre}**\n"
                    f"   Estado: {etiqueta_estado} {semaforo_icon} | Iniciado: {fecha}"
                )
                tramites_contexto.append({
                    "nombre": pol_nombre,
                    "tramite_id": str(t.get("_id", "")),
                })

            resumen = "\n\n".join(lineas)
            tiene_varios = len(tramites_uniq) > 1

            respuesta = (
                f"Aquí están tus trámites:\n\n{resumen}\n\n"
                + (
                    "¿De cuál querés ver el detalle? Podés decirme el número o el nombre "
                    "(por ejemplo: *\"el segundo\"* o *\"el de Medidor de Luz\"*)."
                    if tiene_varios
                    else "¿Querés ver más detalle de este trámite?"
                )
            )
            return {
                "politicas_candidatas": [],
                "politica_recomendada": None,
                "respuesta_agente": respuesta,
                "confianza": 1.0,
                "total_politicas_revisadas": 0,
                "metodo": "estado_tramite",
                "tramites_contexto": tramites_contexto,
            }
        except Exception as exc:
            logger.error("Error al obtener estado tramites: %s", exc)
            return self._sin_tramites_activos()

    def _responder_historial_tramite(self, tramite_id: str, empresa_id: str) -> dict:
        """Devuelve el historial completo del trámite indicado por ID."""
        try:
            import bson
            db = _get_db()
            tramite = db["Tramite"].find_one({"_id": bson.ObjectId(tramite_id)})
            if not tramite:
                return {
                    "politicas_candidatas": [], "politica_recomendada": None,
                    "respuesta_agente": "No pude obtener el historial. Revisá el panel de trámites.",
                    "confianza": 1.0, "total_politicas_revisadas": 0,
                    "metodo": "ver_historial_tramite",
                    "tramite_id": tramite_id,
                }

            nombre = tramite.get("nombre_tramite", "Trámite")
            estado = tramite.get("estado", "en_proceso")
            semaforo = tramite.get("semaforizacion", "")
            fecha_inicio = str(tramite.get("fecha_inicio", ""))[:10]
            historial = tramite.get("historial", [])

            etiqueta_estado = {
                "en_proceso": "En proceso ⚙️",
                "en_revision": "En revisión 🔍",
                "observado": "Observado ⚠️",
                "rechazado": "Rechazado ❌",
                "finalizado": "Finalizado ✅",
            }.get(estado, estado)
            semaforo_icon = {"Rojo": "🔴", "Amarillo": "🟡", "Verde": "🟢"}.get(semaforo, "")

            # Resolver nodo actual a nombre legible
            nodo_actual_id_val = tramite.get("nodo_actual_id", "")
            nodo_actual_nombre = ""
            if nodo_actual_id_val:
                try:
                    nodo_doc = db["Formulario_Nodo"].find_one(
                        {"_id": nodo_actual_id_val}, {"nombre_nodo": 1}
                    )
                    nodo_actual_nombre = (nodo_doc.get("nombre_nodo", "") if nodo_doc else "") or ""
                except Exception:
                    pass
            nodo_txt = f"\n**Etapa actual:** {nodo_actual_nombre}" if nodo_actual_nombre else ""

            if historial:
                items = []
                for i, h in enumerate(historial, 1):
                    paso_nombre = (h.get("nodoNombre") or h.get("accion") or
                                   h.get("nodoId") or "Paso")
                    fecha_raw = h.get("completadoEn") or h.get("fecha") or ""
                    fecha_h = str(fecha_raw)[:10] if fecha_raw else ""
                    quien = h.get("completadoPorNombre") or ""
                    linea = f"   {i}. {paso_nombre}"
                    if quien:
                        linea += f" (por {quien})"
                    if fecha_h:
                        linea += f" — {fecha_h}"
                    items.append(linea)
                hist_txt = "\n".join(items)
            else:
                hist_txt = "   Sin movimientos registrados aún."

            respuesta = (
                f"📋 **Historial completo — {nombre}**\n\n"
                f"**Estado:** {etiqueta_estado} {semaforo_icon}{nodo_txt} | **Iniciado:** {fecha_inicio}\n\n"
                f"**Pasos registrados:**\n{hist_txt}\n\n"
                "Podés ver todos los documentos y detalles del trámite en el panel. "
                "¿Tenés alguna otra consulta?"
            )
            return {
                "politicas_candidatas": [], "politica_recomendada": None,
                "respuesta_agente": respuesta,
                "confianza": 1.0, "total_politicas_revisadas": 0,
                "metodo": "ver_historial_tramite",
                "tramite_id": tramite_id,
            }
        except Exception as exc:
            logger.error("Error historial_tramite: %s", exc)
            return {
                "politicas_candidatas": [], "politica_recomendada": None,
                "respuesta_agente": "No pude obtener el historial. Revisá el panel de trámites.",
                "confianza": 1.0, "total_politicas_revisadas": 0,
                "metodo": "ver_historial_tramite",
                "tramite_id": tramite_id,
            }

    def _responder_tramite_mas_antiguo(self, cliente_id: str, empresa_id: str,
                                        politicas: list) -> dict:
        """Devuelve el trámite activo con mayor antigüedad del cliente."""
        try:
            db = _get_db()
            # Primero busca activos (no finalizados/rechazados), luego cualquiera
            tramite = db["Tramite"].find_one(
                {"cliente_id": cliente_id,
                 "estado": {"$nin": ["finalizado", "rechazado"]}},
                sort=[("fecha_inicio", 1)]
            ) or db["Tramite"].find_one(
                {"cliente_id": cliente_id},
                sort=[("fecha_inicio", 1)]
            )
            if not tramite:
                return self._sin_tramites_activos()

            nombre = tramite.get("nombre_tramite", "")
            if not nombre:
                pol_map = {str(p["_id"]): p.get("nombre", "?")
                           for p in db["Politica"].find(
                               {"empresa_id": empresa_id}, {"nombre": 1})}
                nombre = pol_map.get(str(tramite.get("politica_id", "")), "Trámite sin nombre")

            fecha_inicio = tramite.get("fecha_inicio")
            fecha_str = str(fecha_inicio)[:10] if fecha_inicio else "?"
            estado = tramite.get("estado", "en_proceso")
            semaforo = tramite.get("semaforizacion", "")
            etiqueta_estado = {
                "en_proceso": "En proceso ⚙️",
                "en_revision": "En revisión 🔍",
                "observado": "Observado ⚠️",
                "rechazado": "Rechazado ❌",
                "finalizado": "Finalizado ✅",
            }.get(estado, estado)
            semaforo_icon = {"Rojo": "🔴", "Amarillo": "🟡", "Verde": "🟢"}.get(semaforo, "")

            dias_txt = ""
            try:
                from datetime import datetime
                if hasattr(fecha_inicio, "date"):
                    dias = (datetime.now() - fecha_inicio).days
                    dias_txt = f" — lleva **{dias} días** activo"
            except Exception:
                pass

            respuesta = (
                f"Tu trámite con más tiempo activo es **{nombre}**{dias_txt}.\n\n"
                f"**Estado:** {etiqueta_estado} {semaforo_icon} | **Iniciado:** {fecha_str}\n\n"
                "¿Querés ver el historial de este trámite o tenés alguna otra consulta?"
            )
            return {
                "politicas_candidatas": [], "politica_recomendada": None,
                "respuesta_agente": respuesta,
                "confianza": 1.0, "total_politicas_revisadas": 0,
                "metodo": "tramite_mas_antiguo",
                "tramite_id": str(tramite.get("_id", "")),
            }
        except Exception as exc:
            logger.error("Error tramite_mas_antiguo: %s", exc)
            return self._sin_tramites_activos()

    def _resolver_tramite_seleccionado(self, descripcion: str, tramite_lista: list) -> Optional[int]:
        """Detecta qué tramite quiso seleccionar el usuario de la lista mostrada.
        Retorna índice (0-based) o None si no hay selección clara."""
        if not tramite_lista:
            return None
        d = _quitar_acentos(descripcion.lower())
        n = len(tramite_lista)

        # Número explícito: "el 2", "numero 2", "tramite 2", o solo "2"
        m = re.search(r'\b(?:el|numero|nro|opcion|tramite)\s*(\d+)\b', d) \
            or re.fullmatch(r'\s*(\d{1,2})\s*', descripcion.strip())
        if m:
            idx = int(m.group(1)) - 1
            if 0 <= idx < n:
                return idx

        # Ordinales en texto
        ordinal_map = [
            (0, ["primero", "primer", "primera"]),
            (1, ["segundo", "segunda"]),
            (2, ["tercero", "tercera", "tercer"]),
            (3, ["cuarto", "cuarta"]),
            (4, ["quinto", "quinta"]),
        ]
        for idx, words in ordinal_map:
            if idx < n and any(w in d for w in words):
                return idx

        # "el último" / "el ultima"
        if "ultimo" in d or "ultima" in d:
            return n - 1

        # Nombre parcial del trámite
        for i, t in enumerate(tramite_lista):
            tn = _quitar_acentos(t.get("nombre", "").lower())
            sig = [w for w in tn.split() if len(w) >= 4]
            if len(sig) >= 2 and all(w in d for w in sig[:2]):
                return i
            if len(tn) >= 5 and tn in d:
                return i

        return None

    def _responder_tramite_seleccionado(self, idx: int, tramite_lista: list,
                                         cliente_id: str, empresa_id: str) -> dict:
        """Devuelve detalle del trámite seleccionado por índice."""
        tramite_info = tramite_lista[idx]
        tramite_id = tramite_info.get("tramite_id", "")
        nombre = tramite_info.get("nombre", "Trámite")

        tramite = None
        try:
            import bson
            db = _get_db()
            if tramite_id:
                tramite = db["Tramite"].find_one({"_id": bson.ObjectId(tramite_id)})
        except Exception as exc:
            logger.warning("No se pudo obtener detalle del trámite %s: %s", tramite_id, exc)

        if not tramite:
            return {
                "politicas_candidatas": [], "politica_recomendada": None,
                "respuesta_agente": (
                    f"No pude obtener el detalle de **{nombre}**. "
                    "Revisá el panel de trámites para información completa."
                ),
                "confianza": 1.0, "total_politicas_revisadas": 0,
                "metodo": "tramite_seleccionado",
                "tramites_contexto": tramite_lista,
            }

        estado = tramite.get("estado", "en_proceso")
        semaforo = tramite.get("semaforizacion", "")
        fecha = str(tramite.get("fecha_inicio", ""))[:10]
        historial = tramite.get("historial", [])

        etiqueta_estado = {
            "en_proceso": "En proceso ⚙️",
            "en_revision": "En revisión 🔍",
            "observado": "Observado ⚠️",
            "rechazado": "Rechazado ❌",
            "finalizado": "Finalizado ✅",
        }.get(estado, estado)
        semaforo_icon = {"Rojo": "🔴", "Amarillo": "🟡", "Verde": "🟢"}.get(semaforo, "")

        # Usar nombre_tramite del doc si está disponible (más preciso)
        nombre = tramite.get("nombre_tramite") or nombre

        hist_txt = ""
        if historial:
            items = []
            for h in historial[-5:]:
                # Nombre del paso: nodoNombre (paso completado) o accion (evento)
                paso_nombre = (h.get("nodoNombre") or h.get("accion") or
                               h.get("nodoId") or "Paso")
                # Fecha: completadoEn (ISO string) o fecha (datetime/string)
                fecha_raw = h.get("completadoEn") or h.get("fecha") or ""
                fecha_h = str(fecha_raw)[:10] if fecha_raw else ""
                # Responsable
                quien = h.get("completadoPorNombre") or ""
                linea = f"   • {paso_nombre}"
                if quien:
                    linea += f" (por {quien})"
                if fecha_h:
                    linea += f" — {fecha_h}"
                items.append(linea)
            hist_txt = "\n\n**Historial de pasos:**\n" + "\n".join(items)

        # Nodo actual — resolver UUID a nombre legible
        nodo_actual_id_val = tramite.get("nodo_actual_id", "")
        nodo_actual = ""
        if nodo_actual_id_val:
            try:
                nodo_doc = db["Formulario_Nodo"].find_one(
                    {"_id": nodo_actual_id_val}, {"nombre_nodo": 1}
                )
                nodo_actual = (nodo_doc.get("nombre_nodo", "") if nodo_doc else "") or ""
            except Exception:
                pass
        nodo_txt = f"\n**Etapa actual:** {nodo_actual}" if nodo_actual else ""

        respuesta = (
            f"📋 **{nombre}**\n\n"
            f"**Estado:** {etiqueta_estado} {semaforo_icon}"
            f"{nodo_txt}\n"
            f"**Iniciado:** {fecha}"
            f"{hist_txt}\n\n"
            "¿Querés ver el detalle de otro trámite de la lista o tenés alguna otra consulta?"
        )
        return {
            "politicas_candidatas": [], "politica_recomendada": None,
            "respuesta_agente": respuesta,
            "confianza": 1.0, "total_politicas_revisadas": 0,
            "metodo": "tramite_seleccionado",
            "tramites_contexto": tramite_lista,
            "tramite_id": tramite_id,
        }

    def _sin_tramites_activos(self) -> dict:
        return {
            "politicas_candidatas": [],
            "politica_recomendada": None,
            "respuesta_agente": (
                "No encontré trámites activos en su cuenta. "
                "¿Desea iniciar uno nuevo? Cuénteme qué necesita y le oriento."
            ),
            "confianza": 1.0,
            "total_politicas_revisadas": 0,
            "metodo": "estado_tramite",
        }

    # ── Primer paso: solo documentos del primer formulario del cliente ──

    def _responder_primer_paso(self, politica: dict, empresa_id: str) -> dict:
        """Extrae únicamente los campos del PRIMER paso TAREA del cliente."""
        try:
            db = _get_db()
            # Buscar la política en MongoDB para obtener el _id
            pol_doc = db["Politica"].find_one(
                {"nombre": politica["nombre"], "empresa_id": empresa_id},
                {"esquema_workflow": 1, "_id": 1}
            )
            if not pol_doc:
                raise ValueError("Política no encontrada")

            pasos = pol_doc.get("esquema_workflow", {}).get("pasos", [])
            # Primer paso TAREA del cliente (departamentoId == "cliente")
            primer_form_id = None
            for paso in sorted(pasos, key=lambda p: p.get("orden", 99)):
                if paso.get("tipoPaso") == "TAREA" and paso.get("formularioId"):
                    if paso.get("departamentoId", "").lower() in ("cliente", "client"):
                        primer_form_id = paso["formularioId"]
                        primer_nombre_paso = paso.get("nombre", "")
                        break

            if not primer_form_id:
                # Si no hay paso de cliente, tomar el primero con formulario
                for paso in sorted(pasos, key=lambda p: p.get("orden", 99)):
                    if paso.get("tipoPaso") == "TAREA" and paso.get("formularioId"):
                        primer_form_id = paso["formularioId"]
                        primer_nombre_paso = paso.get("nombre", "")
                        break

            if not primer_form_id:
                return self._responder_seguimiento(politica)

            import bson
            form = db["Formulario_Nodo"].find_one(
                {"_id": bson.ObjectId(primer_form_id)},
                {"nombre_nodo": 1, "esquema_campos": 1, "_id": 0}
            )
            if not form:
                return self._responder_seguimiento(politica)

            campos_texto = []
            campos_archivo = []
            for campo in form.get("esquema_campos", []):
                titulo = (campo.get("titulo") or campo.get("etiqueta") or "").strip()
                tipo = campo.get("tipo", "")
                obligatorio = campo.get("obligatorio", False)
                if not titulo:
                    continue
                if tipo == "archivo" and obligatorio:
                    formatos = campo.get("formatos", ".pdf, .jpg")
                    campos_archivo.append(f"📄 {titulo} ({formatos})")
                elif tipo in ("texto", "numero", "lista", "fecha") and obligatorio:
                    campos_texto.append(f"✏️ {titulo}")

            todos = campos_texto + campos_archivo
            if not todos:
                todos = ["📄 Documentos de identidad", "✏️ Formulario de solicitud"]

            campos_txt = "\n".join(todos)
            nombre_pol = politica["nombre"]
            duracion = politica.get("duracion_dias", 0)

            # Calcular cuántos pasos hay después del primero
            total_pasos = len([p for p in pasos if p.get("tipoPaso") not in ("INICIO", "FIN", "GATEWAY")])

            respuesta = (
                f"Para **iniciar** el trámite *{nombre_pol}*, en el **primer paso** necesitás completar:\n\n"
                f"{campos_txt}\n\n"
                f"📋 *Proceso:* {total_pasos} pasos en total — duración estimada: **{duracion} días hábiles**.\n\n"
                "Una vez que envíes tu solicitud, el funcionario asignado revisará tu documentación. "
                "Te notificaremos cuando avance al siguiente paso.\n\n"
                "¿Querés iniciar el trámite ahora o tenés alguna otra pregunta?"
            )

            politica_resp = {**politica, "requisitos": todos, "score": 1.0}

            return {
                "politicas_candidatas": [politica_resp],
                "politica_recomendada": politica_resp,
                "respuesta_agente": respuesta,
                "confianza": 1.0,
                "total_politicas_revisadas": 1,
                "metodo": "primer_paso",
                "puede_iniciar": False,
            }
        except Exception as exc:
            logger.warning("Error en primer_paso: %s", exc)
            return self._responder_seguimiento(politica)

    def _responder_iniciar(self, politica: dict, empresa_id: str) -> dict:
        """HitL: cliente confirmó que quiere iniciar — ahora sí devuelve el botón."""
        try:
            db = _get_db()
            pol_doc = db["Politica"].find_one(
                {"nombre": politica["nombre"], "empresa_id": empresa_id},
                {"_id": 1}
            )
            if not pol_doc:
                pol_doc = db["Politica"].find_one({"nombre": politica["nombre"]}, {"_id": 1})
            pol_mongo_id = str(pol_doc["_id"]) if pol_doc else ""
        except Exception:
            pol_mongo_id = ""

        nombre = politica["nombre"]
        respuesta = (
            f"¡Perfecto! Vamos a iniciar el trámite **{nombre}** ahora mismo. "
            "Presioná el botón de abajo para abrir el formulario de solicitud. 👇"
        )
        pol_resp = {**politica, "score": 1.0}
        return {
            "politicas_candidatas": [pol_resp],
            "politica_recomendada": pol_resp,
            "respuesta_agente": respuesta,
            "confianza": 1.0,
            "total_politicas_revisadas": 1,
            "metodo": "quiere_iniciar",
            "politica_mongo_id": pol_mongo_id,
            "puede_iniciar": True,
        }

    def _responder_flujo_completo(self, politica: dict, empresa_id: str) -> dict:
        """Muestra TODOS los pasos del flujo con sus campos por paso."""
        try:
            db = _get_db()
            pol_doc = db["Politica"].find_one(
                {"nombre": politica["nombre"], "empresa_id": empresa_id},
                {"esquema_workflow": 1, "_id": 1}
            )
            if not pol_doc:
                return self._responder_seguimiento(politica)

            politica_mongo_id = str(pol_doc["_id"])
            pasos = pol_doc.get("esquema_workflow", {}).get("pasos", [])
            tareas = [p for p in sorted(pasos, key=lambda p: p.get("orden", 99))
                      if p.get("tipoPaso") == "TAREA"]

            import bson as _bson
            bloques = []
            for i, paso in enumerate(tareas, 1):
                nombre_paso = paso.get("nombre", f"Paso {i}")
                form_id = paso.get("formularioId")

                campos_txt = []
                if form_id:
                    try:
                        form = db["Formulario_Nodo"].find_one(
                            {"_id": _bson.ObjectId(form_id)},
                            {"esquema_campos": 1, "_id": 0}
                        )
                        if form:
                            for campo in form.get("esquema_campos", []):
                                titulo = (campo.get("titulo") or campo.get("etiqueta") or "").strip()
                                tipo = campo.get("tipo", "")
                                oblig = campo.get("obligatorio", False)
                                if not titulo or not oblig:
                                    continue
                                if tipo == "archivo":
                                    fmt = campo.get("formatos", ".pdf")
                                    campos_txt.append(f"   📄 {titulo} ({fmt})")
                                elif tipo in ("texto", "numero", "lista", "fecha"):
                                    campos_txt.append(f"   ✏️ {titulo}")
                    except Exception:
                        pass

                if campos_txt:
                    bloque = f"**Paso {i}: {nombre_paso}**\n" + "\n".join(campos_txt)
                else:
                    bloque = f"**Paso {i}: {nombre_paso}**\n   _(revisión interna)_"
                bloques.append(bloque)

            flujo_txt = "\n\n".join(bloques)
            nombre_pol = politica["nombre"]
            duracion = politica.get("duracion_dias", 0)
            total_pasos = len(tareas)

            respuesta = (
                f"Acá está el flujo completo del trámite **{nombre_pol}** "
                f"({total_pasos} pasos — {duracion} días hábiles):\n\n"
                f"{flujo_txt}\n\n"
                "¿Querés iniciar el trámite ahora o tenés alguna pregunta más?"
            )

            pol_con_id = {**politica, "score": 1.0}
            return {
                "politicas_candidatas": [pol_con_id],
                "politica_recomendada": pol_con_id,
                "respuesta_agente": respuesta,
                "confianza": 1.0,
                "total_politicas_revisadas": 1,
                "metodo": "flujo_completo",
                "puede_iniciar": False,
            }
        except Exception as exc:
            logger.warning("Error en flujo_completo: %s", exc)
            return self._responder_seguimiento(politica)

    def _responder_siguiente_paso(self, politica: dict, empresa_id: str,
                                   paso_actual: int = -1) -> dict:
        """
        Muestra el paso N+1 del flujo.
        paso_actual=-1 → mostrar paso 0 (primero)
        paso_actual=0  → mostrar paso 1 (segundo), etc.
        """
        try:
            db = _get_db()
            pol_doc = db["Politica"].find_one(
                {"nombre": politica["nombre"], "empresa_id": empresa_id},
                {"esquema_workflow": 1, "_id": 0}
            )
            pasos = pol_doc.get("esquema_workflow", {}).get("pasos", []) if pol_doc else []
            tareas = [p for p in sorted(pasos, key=lambda p: p.get("orden", 99))
                      if p.get("tipoPaso") == "TAREA"]

            if not tareas:
                raise ValueError("sin tareas")

            # Índice a mostrar: si paso_actual=-1, mostrar el primero (0)
            idx_mostrar = max(paso_actual + 1, 0)

            if idx_mostrar >= len(tareas):
                # Ya mostramos todos los pasos
                nombre_pol = politica["nombre"]
                respuesta = (
                    f"¡Eso es todo el proceso de **{nombre_pol}**! "
                    f"Son **{len(tareas)} pasos** en total.\n\n"
                    "Cuando iniciás el trámite, el sistema te guía automáticamente por cada paso.\n\n"
                    "¿Querés iniciar el trámite ahora?"
                )
                return {
                    "politicas_candidatas": [{**politica, "score": 1.0}],
                    "politica_recomendada": {**politica, "score": 1.0},
                    "respuesta_agente": respuesta,
                    "confianza": 1.0,
                    "total_politicas_revisadas": 1,
                    "metodo": "siguiente_paso",
                    "paso_siguiente": len(tareas),
                    "puede_iniciar": False,
                }

            paso = tareas[idx_mostrar]
            nombre_paso = paso.get("nombre", f"Paso {idx_mostrar + 1}")
            total = len(tareas)
            hay_mas = idx_mostrar + 1 < total

            # Cargar campos del formulario de este paso
            import bson as _bson
            campos_txt = []
            form_id = paso.get("formularioId")
            if form_id:
                try:
                    form = db["Formulario_Nodo"].find_one(
                        {"_id": _bson.ObjectId(form_id)},
                        {"esquema_campos": 1, "_id": 0}
                    )
                    if form:
                        for campo in form.get("esquema_campos", []):
                            titulo = (campo.get("titulo") or campo.get("etiqueta") or "").strip()
                            tipo = campo.get("tipo", "")
                            oblig = campo.get("obligatorio", False)
                            if not titulo or not oblig:
                                continue
                            if tipo == "archivo":
                                fmt = campo.get("formatos", ".pdf")
                                campos_txt.append(f"   📄 {titulo} ({fmt})")
                            elif tipo in ("texto", "numero", "lista", "fecha"):
                                campos_txt.append(f"   ✏️ {titulo}")
                except Exception:
                    pass

            num_paso = idx_mostrar + 1
            if campos_txt:
                campos_bloque = "\n" + "\n".join(campos_txt)
            else:
                campos_bloque = "\n   _(revisión interna — sin campos para el cliente)_"

            if hay_mas:
                proximo = tareas[idx_mostrar + 1].get("nombre", f"Paso {num_paso + 1}")
                continuacion = f"\nDespués viene el **Paso {num_paso + 1}: {proximo}**. ¿Querés que te lo explique?"
            else:
                continuacion = f"\n\n✅ ¡Este es el **último paso** del proceso! Duración total: **{politica.get('duracion_dias', 0)} días hábiles**."

            respuesta = (
                f"**Paso {num_paso} de {total}: {nombre_paso}**{campos_bloque}\n\n"
                f"{continuacion}"
            )

            return {
                "politicas_candidatas": [{**politica, "score": 1.0}],
                "politica_recomendada": {**politica, "score": 1.0},
                "respuesta_agente": respuesta,
                "confianza": 1.0,
                "total_politicas_revisadas": 1,
                "metodo": "siguiente_paso",
                "paso_siguiente": idx_mostrar,  # índice que se mostró → FAB lo guarda
            }
        except Exception as exc:
            logger.warning("Error en siguiente_paso: %s", exc)
            return {
                "politicas_candidatas": [{**politica, "score": 1.0}],
                "politica_recomendada": {**politica, "score": 1.0},
                "respuesta_agente": "Después de enviar tu solicitud, el equipo encargado revisa y te notificamos. ¿Querés iniciar ahora?",
                "confianza": 1.0,
                "total_politicas_revisadas": 1,
                "metodo": "siguiente_paso",
            }

    def _responder_seguimiento(self, politica: dict) -> dict:
        """Respuesta de seguimiento sobre política ya conocida."""
        nombre = politica["nombre"]
        duracion = politica.get("duracion_dias", 0)
        requisitos = politica.get("requisitos", [])
        req_txt = "\n".join(requisitos[:8]) if requisitos else "📄 Documentos de identidad"
        respuesta = (
            f"Sobre el trámite **{nombre}**:\n\n"
            f"⏱ Duración: {duracion} días hábiles\n\n"
            f"Documentación necesaria:\n{req_txt}\n\n"
            "¿Deseás iniciar este trámite ahora o tenés alguna otra consulta?"
        )
        return {
            "politicas_candidatas": [{**politica, "score": 1.0}],
            "politica_recomendada": {**politica, "score": 1.0},
            "respuesta_agente": respuesta,
            "confianza": 1.0,
            "total_politicas_revisadas": 1,
            "metodo": "seguimiento",
        }

    def _es_consulta_listado(self, texto: str) -> bool:
        texto_l = texto.lower()
        patrones = [
            "qué políticas", "que politicas", "qué tramites", "que tramites",
            "cuáles son", "cuales son", "qué hay", "que hay disponible",
            "qué servicios", "qué puedo", "que puedo", "qué opciones",
            "me puedes decir", "dime qué", "listame", "listar",
            "qué tramite existe", "hay disponibles", "tienen disponible",
            "iniciar otro", "comenzar otro", "iniciar un nuevo", "comenzar un nuevo",
            "otro tramite disponible", "nuevo tramite", "tramites disponibles",
            "que tramites puedo", "que opciones de tramite",
        ]
        return any(p in texto_l for p in patrones)

    def _responder_listado(self, descripcion: str, politicas: list) -> dict:
        lineas = []
        for i, p in enumerate(politicas, 1):
            dur = p['duracion_dias']
            dur_txt = f"{dur} días hábiles" if dur else "sin plazo definido"
            lineas.append(f"{i}. **{p['nombre']}** — {dur_txt}")
        lista = "\n".join(lineas)
        respuesta = (
            f"Contamos con **{len(politicas)} trámites disponibles**:\n\n"
            f"{lista}\n\n"
            "¿Sobre cuál querés más información? Contame tu situación y te indico exactamente "
            "qué documentos necesitás y cómo iniciar."
        )
        return {
            "politicas_candidatas": [
                {"nombre": p["nombre"], "descripcion": p["descripcion"],
                 "requisitos": p["requisitos"], "score": 1.0, "duracion_dias": p["duracion_dias"]}
                for p in politicas
            ],
            "politica_recomendada": None,
            "respuesta_agente": respuesta,
            "confianza": 1.0,
            "total_politicas_revisadas": len(politicas),
            "metodo": "listado",
        }

    # ── Ranking local por keywords ──────────────────────────────────

    def _clasificar_local(self, descripcion: str, politicas: list) -> dict:
        tokens_consulta = self._tokenizar(descripcion)
        resultados = []

        for politica in politicas:
            texto = f"{politica['nombre']} {politica['descripcion']} {' '.join(politica['pasos'])}"
            tokens_pol = self._tokenizar(texto)
            score = self._calcular_score(tokens_consulta, tokens_pol)
            if score > 0:
                resultados.append({**politica, "score": round(score, 3)})

        resultados.sort(key=lambda x: x["score"], reverse=True)
        candidatas = resultados[:5]
        recomendada = candidatas[0] if candidatas else None
        confianza = recomendada["score"] if recomendada else 0.0

        return {
            "politicas_candidatas": candidatas,
            "politica_recomendada": recomendada,
            "respuesta_agente": self._respuesta_callcenter(descripcion, recomendada, candidatas, politicas),
            "confianza": min(confianza, 1.0),
            "total_politicas_revisadas": len(politicas),
            "metodo": "keyword_matching",
        }

    def _tokenizar(self, texto: str) -> set:
        # Normaliza acentos antes de extraer tokens → "médico" == "medico"
        texto_norm = _quitar_acentos(texto.lower())
        palabras = re.findall(r"[a-z]+", texto_norm)
        return {p for p in palabras if p not in self._STOPWORDS_NORM and len(p) > 2}

    def _calcular_score(self, tokens_consulta: set, tokens_politica: set) -> float:
        """Score con fuzzy matching: cuenta coincidencias exactas + similares."""
        if not tokens_consulta or not tokens_politica:
            return 0.0
        matches = 0
        for tq in tokens_consulta:
            # Exacto primero (O(1))
            if tq in tokens_politica:
                matches += 1
                continue
            # Fuzzy: busca token similar en la política
            if any(_tokens_similares(tq, tp) for tp in tokens_politica):
                matches += 0.8  # penalización leve por no ser exacto
        return matches / max(len(tokens_consulta), 1)

    def _respuesta_callcenter(self, descripcion: str, recomendada: Optional[dict],
                               candidatas: list, todas: list) -> str:
        if not recomendada:
            lista = ", ".join([p["nombre"] for p in todas[:5]])
            return (
                f"Entiendo su consulta: \"{descripcion}\". "
                "No encontré una coincidencia exacta, pero nuestros trámites disponibles son: "
                f"{lista}. ¿Podría describirme con más detalle lo que necesita? "
                "Así puedo orientarle mejor."
            )

        nombre = recomendada["nombre"]
        duracion = recomendada.get("duracion_dias", 0)
        requisitos = recomendada.get("requisitos", [])
        req_txt = "\n".join([f"  ✓ {r}" for r in requisitos]) if requisitos else "  ✓ Documentos de identidad"

        alternativas = ""
        otros = [c["nombre"] for c in candidatas[1:3] if c["nombre"] != nombre]
        if otros:
            alternativas = f"\n\nOtras opciones relacionadas: {', '.join(otros)}."

        return (
            f"Basándome en su solicitud, el trámite que le corresponde es:\n\n"
            f"**{nombre}**\n"
            f"⏱ Duración estimada: {duracion} días hábiles\n\n"
            f"Para iniciar necesitará:\n{req_txt}"
            f"{alternativas}\n\n"
            "¿Desea iniciar este proceso ahora o tiene alguna otra consulta?"
        )

    # ── Clasificación con IA (OpenAI/Groq) — multi-turn ────────────

    def _clasificar_con_ia(self, descripcion: str, politicas: list,
                            historial: list = None, politica_contexto: str = "",
                            cliente_id: str = "", empresa_id: str = "") -> dict:
        from openai import OpenAI
        import json

        historial = historial or []

        oa = OpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url or None,
        )

        lista_pol = "\n".join([
            f"- Nombre: {p['nombre']} | Pasos: {', '.join(p['pasos'][:3])} | "
            f"Duración: {p['duracion_dias']} días"
            for p in politicas[:20]
        ])

        contexto_extra = ""
        if politica_contexto:
            contexto_extra = (
                f"\n\nCONTEXTO CONVERSACIÓN: El cliente ya consultó sobre el trámite "
                f'"{politica_contexto}". Si pregunta algo relacionado, respondé en ese contexto '
                "sin volver a preguntar de qué trámite se trata."
            )

        system_msg = (
            "Eres NexusBot, agente de call center inteligente de NexusFlow. "
            "Orientas a clientes sobre trámites de manera amable, concisa y natural. "
            "No eres rígido — si el cliente ya eligió un trámite, no le preguntes cuál es. "
            "Si pregunta qué documentos necesita para iniciar, muestra solo los del PRIMER paso. "
            "Si pregunta por el estado de su trámite y no tienes datos, dile que puede verlo en el panel. "
            "Responde siempre en español, tono cercano y profesional.\n"
            "REGLA CRÍTICA: Si el cliente menciona explícitamente el nombre de un trámite "
            "(ej: 'Solicitud de Medidor de Luz'), politica_nombre DEBE ser ese trámite exacto. "
            "NUNCA recomiendes un trámite diferente al que el cliente preguntó. "
            "Si no hay trámite explícito, usa el contexto conversacional para elegir."
            f"\n\nTrámites disponibles:\n{lista_pol}"
            f"{contexto_extra}\n\n"
            "Responde SOLO con JSON:\n"
            '{"politica_nombre": "nombre exacto o null", "confianza": 0.95, '
            '"respuesta": "mensaje al cliente"}'
        )

        # Construir historial multi-turn para OpenAI
        messages = [{"role": "system", "content": system_msg}]
        for msg in historial[-4:]:  # últimos 4 turnos máx
            rol = "user" if msg.get("rol") == "user" else "assistant"
            texto = msg.get("texto", "")
            if texto:
                messages.append({"role": rol, "content": texto})

        messages.append({"role": "user", "content": descripcion})

        response = oa.chat.completions.create(
            model=settings.openai_model,
            messages=messages,
            temperature=0.4,
            response_format={"type": "json_object"},
        )

        data = json.loads(response.choices[0].message.content)
        nombre_ia = data.get("politica_nombre")

        recomendada = None
        if nombre_ia:
            match = next(
                (p for p in politicas if p["nombre"].lower() == nombre_ia.lower()), None
            )
            if not match:
                match = next(
                    (p for p in politicas
                     if nombre_ia.lower() in p["nombre"].lower()
                     or p["nombre"].lower() in nombre_ia.lower()),
                    None
                )
            if match:
                recomendada = {**match, "score": float(data.get("confianza", 0.9))}

        # Si hay contexto pero IA no identificó política, buscar por contexto
        if not recomendada and politica_contexto:
            match = next(
                (p for p in politicas
                 if politica_contexto.lower() in p["nombre"].lower()),
                None
            )
            if match:
                recomendada = {**match, "score": 0.85}

        candidatas = []
        if recomendada:
            candidatas = [recomendada]
            tokens = self._tokenizar(recomendada["nombre"])
            for p in politicas:
                if p["nombre"] != recomendada["nombre"]:
                    if self._calcular_score(tokens, self._tokenizar(p["nombre"])) > 0:
                        candidatas.append({**p, "score": 0.5})
            candidatas = candidatas[:5]
        else:
            candidatas = [{**p, "score": 1.0} for p in politicas[:5]]

        # Detectar cambio de tema: si IA recomienda política distinta al contexto → nueva clasificación
        if politica_contexto and recomendada:
            rec_norm = _quitar_acentos(recomendada["nombre"].lower())
            ctx_norm = _quitar_acentos(politica_contexto.lower())
            topic_changed = (rec_norm != ctx_norm
                             and ctx_norm not in rec_norm
                             and rec_norm not in ctx_norm)
            metodo_ret = "ia_openai" if topic_changed else "ia_seguimiento"
        elif politica_contexto:
            metodo_ret = "ia_seguimiento"
        else:
            metodo_ret = "ia_openai"
        return {
            "politicas_candidatas": candidatas,
            "politica_recomendada": recomendada,
            "respuesta_agente": data.get("respuesta", ""),
            "confianza": float(data.get("confianza", 0.9)),
            "total_politicas_revisadas": len(politicas),
            "metodo": metodo_ret,
        }

    def listar_politicas(self, empresa_id: str) -> dict:
        """Endpoint auxiliar: lista todas las políticas activas."""
        politicas = self._cargar_politicas(empresa_id)
        return {
            "empresa_id": empresa_id,
            "total": len(politicas),
            "politicas": [
                {"nombre": p["nombre"], "duracion_dias": p["duracion_dias"],
                 "descripcion": p["descripcion"]}
                for p in politicas
            ]
        }
