"""
NexusFlow AI - Servicio de Aprendizaje Automático (ML)
=======================================================
Motor de aprendizaje que entrena modelos predictivos a partir
de la colección Bitácora en MongoDB para:

  - Predecir prioridad y estado futuro de trámites
  - Detectar cuellos de botella antes de que ocurran
  - Recomendar acciones basadas en patrones exitosos

Técnica: Scikit-learn (RandomForest / GradientBoosting)
Datos: Colección Bitácora de MongoDB (nexusflow_oficial)

Autor: Equipo NexusFlow
Versión: 1.0.0
"""

import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

import joblib
import numpy as np
import pandas as pd
from pymongo import MongoClient
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

from ..config import settings

logger = logging.getLogger(__name__)

# ============================================================
# CONSTANTES DEL SERVICIO ML
# ============================================================

# Mapeo de acciones conocidas a valores numéricos
ACCIONES_ENCODING: Dict[str, int] = {
    "INICIO_PROCESO": 0,
    "LLENADO_FORMULARIO": 1,
    "APROBAR": 2,
    "OBSERVAR": 3,
    "RECHAZAR": 4,
    "AUTO_RELLENADO_VOZ": 5,
    "SUBIDA_EVIDENCIA": 6,
    "ELIMINACION_EVIDENCIA": 7,
    "REASIGNACION_AUTOMATICA": 8,
}

# Mapeo de estados a valores numéricos
ESTADOS_ENCODING: Dict[str, int] = {
    "pendiente": 0,
    "en_progreso": 1,
    "observado": 2,
    "finalizado": 3,
    "rechazado": 4,
}

# Mapeo de prioridades a valores numéricos
PRIORIDADES_ENCODING: Dict[str, int] = {
    "Baja": 0,
    "Media": 1,
    "Alta": 2,
}

# Mínimo de registros para entrenar un modelo
MINIMO_REGISTROS_ENTRENAMIENTO = 30

# Nombre del modelo persistido
NOMBRE_MODELO_ESTADO = "predictor_estado.pkl"
NOMBRE_MODELO_PRIORIDAD = "predictor_prioridad.pkl"
NOMBRE_ENCODERS = "label_encoders.pkl"


class MLService:
    """
    Servicio de Machine Learning que aprende de la Bitácora de NexusFlow.

    Funcionalidades:
    - Entrena modelos RandomForest desde datos de la Bitácora en MongoDB
    - Predice el estado probable y la prioridad de trámites nuevos
    - Almacena métricas de entrenamiento en Base_Conocimiento_IA

    Los modelos se serializan como archivos .pkl en el directorio ml_models/
    """

    def __init__(self):
        self._client: Optional[MongoClient] = None
        self._db = None
        self._modelo_estado: Optional[RandomForestClassifier] = None
        self._modelo_prioridad: Optional[GradientBoostingClassifier] = None
        self._encoders: Dict[str, LabelEncoder] = {}
        self._models_dir = Path(settings.ml_models_dir)
        self._models_dir.mkdir(parents=True, exist_ok=True)
        self._conectar_mongodb()
        self._cargar_modelos()

    # ============================================================
    # CONEXIÓN A MONGODB
    # ============================================================

    def _conectar_mongodb(self) -> None:
        """Establece conexión con MongoDB (misma instancia que Spring Boot)."""
        try:
            self._client = MongoClient(
                settings.mongodb_uri,
                serverSelectionTimeoutMS=5000,
            )
            # Verificar conexión
            self._client.admin.command("ping")
            self._db = self._client[settings.mongodb_database]
            logger.info(
                "MLService conectado a MongoDB: %s/%s",
                settings.mongodb_uri,
                settings.mongodb_database,
            )
        except Exception as error:
            logger.warning(
                "MLService: No se pudo conectar a MongoDB: %s. "
                "El entrenamiento no estará disponible.",
                error,
            )
            self._db = None

    # ============================================================
    # MÉTODO 1: ENTRENAR MODELOS DESDE LA BITÁCORA
    # ============================================================

    def entrenar_desde_bitacora(self) -> Dict[str, Any]:
        """
        Lee la colección Bitácora de MongoDB, extrae features relevantes
        y entrena modelos de clasificación para predecir estado y prioridad.

        Returns:
            Diccionario con métricas del entrenamiento (accuracy, samples, status).
        """
        if self._db is None:
            return {
                "status": "error",
                "mensaje": "No hay conexión con MongoDB. Verifique la configuración.",
            }

        # 1. Leer datos de la Bitácora
        bitacoras = list(self._db["Bitacora"].find())
        total_registros = len(bitacoras)

        if total_registros < MINIMO_REGISTROS_ENTRENAMIENTO:
            return {
                "status": "insuficiente",
                "mensaje": (
                    f"Se necesitan al menos {MINIMO_REGISTROS_ENTRENAMIENTO} registros "
                    f"para entrenar. Actualmente hay {total_registros}."
                ),
                "registros_actuales": total_registros,
                "registros_minimos": MINIMO_REGISTROS_ENTRENAMIENTO,
            }

        logger.info("Iniciando entrenamiento con %d registros de Bitácora", total_registros)

        # 2. Enriquecer con datos de Trámites
        tramites = {
            str(t["_id"]): t
            for t in self._db["Tramite"].find()
        }

        # 3. Construir DataFrame de features
        registros_procesados = self._construir_features(bitacoras, tramites)

        if len(registros_procesados) < MINIMO_REGISTROS_ENTRENAMIENTO:
            return {
                "status": "insuficiente",
                "mensaje": "No hay suficientes registros válidos después del preprocesamiento.",
                "registros_validos": len(registros_procesados),
            }

        df = pd.DataFrame(registros_procesados)
        logger.info("Features construidas: %d registros, %d columnas", len(df), len(df.columns))

        # 4. Entrenar modelo de predicción de ESTADO
        metricas_estado = self._entrenar_modelo_estado(df)

        # 5. Entrenar modelo de predicción de PRIORIDAD
        metricas_prioridad = self._entrenar_modelo_prioridad(df, tramites)

        # 6. Persistir modelos
        self._guardar_modelos()

        # 7. Registrar en Base_Conocimiento_IA
        resultado = {
            "status": "entrenado",
            "fecha_entrenamiento": datetime.now().isoformat(),
            "total_registros_bitacora": total_registros,
            "registros_procesados": len(df),
            "modelo_estado": metricas_estado,
            "modelo_prioridad": metricas_prioridad,
        }

        self._registrar_conocimiento(resultado)
        logger.info("Entrenamiento completado: %s", resultado)
        return resultado

    # ============================================================
    # MÉTODO 2: PREDECIR ESTADO Y PRIORIDAD DE UN TRÁMITE
    # ============================================================

    def predecir(self, datos_tramite: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predice el estado probable y la prioridad recomendada para un trámite.

        Args:
            datos_tramite: Diccionario con los datos actuales del trámite.

        Returns:
            Predicción con estado, prioridad, confianza y recomendación.
        """
        if self._modelo_estado is None and self._modelo_prioridad is None:
            return {
                "status": "sin_modelo",
                "mensaje": (
                    "No hay modelos entrenados. Ejecute primero POST /ia/entrenar "
                    "para entrenar los modelos desde la Bitácora."
                ),
            }

        # Extraer features del trámite
        features = self._extraer_features_prediccion(datos_tramite)
        feature_array = np.array([list(features.values())])

        resultado: Dict[str, Any] = {
            "tramite_id": datos_tramite.get("tramite_id", "desconocido"),
            "features_utilizadas": features,
        }

        # Predicción de ESTADO
        if self._modelo_estado is not None:
            prediccion_estado = self._modelo_estado.predict(feature_array)[0]
            probabilidades_estado = self._modelo_estado.predict_proba(feature_array)[0]
            confianza_estado = float(max(probabilidades_estado))

            # Decodificar estado numérico a string
            estado_decodificado = self._decodificar_estado(int(prediccion_estado))

            resultado["estado_predicho"] = estado_decodificado
            resultado["confianza_estado"] = round(confianza_estado, 3)

        # Predicción de PRIORIDAD
        if self._modelo_prioridad is not None:
            prediccion_prioridad = self._modelo_prioridad.predict(feature_array)[0]
            probabilidades_prioridad = self._modelo_prioridad.predict_proba(feature_array)[0]
            confianza_prioridad = float(max(probabilidades_prioridad))

            prioridad_decodificada = self._decodificar_prioridad(int(prediccion_prioridad))

            resultado["prioridad_recomendada"] = prioridad_decodificada
            resultado["confianza_prioridad"] = round(confianza_prioridad, 3)

        # Generar recomendación textual
        resultado["recomendacion"] = self._generar_recomendacion_ml(resultado)
        resultado["status"] = "prediccion_exitosa"

        return resultado

    # ============================================================
    # MÉTODO 3: OBTENER ESTADO DEL MODELO
    # ============================================================

    def obtener_estado_modelo(self) -> Dict[str, Any]:
        """
        Retorna información sobre el estado actual de los modelos entrenados.

        Returns:
            Diccionario con información de modelos, última fecha de entrenamiento, etc.
        """
        estado: Dict[str, Any] = {
            "mongodb_conectado": self._db is not None,
            "modelo_estado_cargado": self._modelo_estado is not None,
            "modelo_prioridad_cargado": self._modelo_prioridad is not None,
        }

        # Contar registros en Bitácora
        if self._db is not None:
            try:
                estado["registros_bitacora"] = self._db["Bitacora"].count_documents({})
                estado["tramites_totales"] = self._db["Tramite"].count_documents({})

                # Último entrenamiento registrado
                ultimo = self._db["Base_Conocimiento_IA"].find_one(
                    sort=[("fecha_entrenamiento", -1)]
                )
                if ultimo:
                    estado["ultimo_entrenamiento"] = str(ultimo.get("fecha_entrenamiento", ""))
                    estado["ultimo_accuracy_estado"] = ultimo.get("modelo_estado", {}).get("accuracy")
                    estado["ultimo_accuracy_prioridad"] = ultimo.get("modelo_prioridad", {}).get("accuracy")
                else:
                    estado["ultimo_entrenamiento"] = None
            except Exception as error:
                logger.warning("Error consultando MongoDB: %s", error)
                estado["registros_bitacora"] = "Error al consultar"

        # Verificar archivos de modelo
        modelo_estado_path = self._models_dir / NOMBRE_MODELO_ESTADO
        modelo_prioridad_path = self._models_dir / NOMBRE_MODELO_PRIORIDAD

        estado["archivo_modelo_estado"] = str(modelo_estado_path) if modelo_estado_path.exists() else None
        estado["archivo_modelo_prioridad"] = str(modelo_prioridad_path) if modelo_prioridad_path.exists() else None

        return estado

    # ============================================================
    # MÉTODOS PRIVADOS: CONSTRUCCIÓN DE FEATURES
    # ============================================================

    def _construir_features(
        self,
        bitacoras: List[Dict],
        tramites: Dict[str, Dict],
    ) -> List[Dict[str, Any]]:
        """
        Transforma registros crudos de Bitácora en vectores de features numéricos.

        Features extraídas:
        - accion_encoded: Tipo de acción codificada numéricamente
        - tiempo_en_nodo: Tiempo de permanencia en el nodo (horas)
        - tiene_detalle_ia: Si el registro tiene metadatos de IA
        - cantidad_campos: Cantidad de campos en esquema_campos
        - estado_encoded: Estado del trámite codificado numéricamente
        """
        registros = []

        for bitacora in bitacoras:
            accion = bitacora.get("accion", "")
            estado = bitacora.get("estado", "")
            detalle = bitacora.get("detalle_ia") or {}
            tramite_id = bitacora.get("tramite_id", "")

            # Buscar datos enriquecidos del trámite
            tramite_data = tramites.get(tramite_id, {})

            # Calcular tiempo en nodo desde detalle_ia
            tiempo_en_nodo = 0.0
            if isinstance(detalle, dict):
                tiempo_en_nodo = float(detalle.get("tiempo_en_nodo", 0))

            registro = {
                "accion_encoded": ACCIONES_ENCODING.get(accion, len(ACCIONES_ENCODING)),
                "tiempo_en_nodo": tiempo_en_nodo,
                "tiene_detalle_ia": 1 if detalle else 0,
                "cantidad_campos": int(detalle.get("campos_configurados", 0)) if isinstance(detalle, dict) else 0,
                "estado_encoded": ESTADOS_ENCODING.get(estado, len(ESTADOS_ENCODING)),
            }

            # Features adicionales del trámite (si existen)
            if tramite_data:
                semaforizacion = tramite_data.get("semaforizacion", "Verde")
                semaforo_map = {"Verde": 0, "Amarillo": 1, "Rojo": 2}
                registro["semaforo_encoded"] = semaforo_map.get(semaforizacion, 0)

                prioridad = tramite_data.get("prioridad", "Media")
                registro["prioridad_encoded"] = PRIORIDADES_ENCODING.get(prioridad, 1)

                # Cantidad de pasos en el historial
                historial = tramite_data.get("historial", [])
                registro["cantidad_pasos_historial"] = len(historial) if isinstance(historial, list) else 0
            else:
                registro["semaforo_encoded"] = 0
                registro["prioridad_encoded"] = 1
                registro["cantidad_pasos_historial"] = 0

            registros.append(registro)

        return registros

    # ============================================================
    # MÉTODOS PRIVADOS: ENTRENAMIENTO DE MODELOS
    # ============================================================

    def _entrenar_modelo_estado(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Entrena un RandomForest para predecir el ESTADO del trámite.

        Returns:
            Métricas del modelo entrenado.
        """
        feature_cols = [
            "accion_encoded", "tiempo_en_nodo", "tiene_detalle_ia",
            "cantidad_campos", "semaforo_encoded", "cantidad_pasos_historial",
        ]

        X = df[feature_cols].fillna(0)
        y = df["estado_encoded"].fillna(0).astype(int)

        # Verificar variabilidad en las etiquetas
        if y.nunique() < 2:
            logger.warning("Solo hay una clase en estado_encoded. Modelo no puede entrenar.")
            return {"accuracy": 0.0, "mensaje": "Datos insuficientes: solo una clase de estado"}

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y if y.nunique() > 1 else None,
        )

        modelo = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            n_jobs=-1,
        )
        modelo.fit(X_train, y_train)

        accuracy = round(modelo.score(X_test, y_test), 4)
        self._modelo_estado = modelo

        # Importancia de features
        importancias = dict(zip(feature_cols, [round(float(i), 4) for i in modelo.feature_importances_]))

        logger.info("Modelo Estado entrenado — Accuracy: %.4f", accuracy)

        return {
            "accuracy": accuracy,
            "samples_train": len(X_train),
            "samples_test": len(X_test),
            "clases": list(y.unique()),
            "importancia_features": importancias,
        }

    def _entrenar_modelo_prioridad(
        self, df: pd.DataFrame, tramites: Dict[str, Dict],
    ) -> Dict[str, Any]:
        """
        Entrena un GradientBoosting para predecir la PRIORIDAD del trámite.

        Returns:
            Métricas del modelo entrenado.
        """
        feature_cols = [
            "accion_encoded", "tiempo_en_nodo", "tiene_detalle_ia",
            "cantidad_campos", "estado_encoded", "cantidad_pasos_historial",
        ]

        X = df[feature_cols].fillna(0)
        y = df["prioridad_encoded"].fillna(1).astype(int)

        if y.nunique() < 2:
            logger.warning("Solo hay una clase en prioridad_encoded. Modelo no puede entrenar.")
            return {"accuracy": 0.0, "mensaje": "Datos insuficientes: solo una clase de prioridad"}

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y if y.nunique() > 1 else None,
        )

        modelo = GradientBoostingClassifier(
            n_estimators=80,
            max_depth=5,
            learning_rate=0.1,
            random_state=42,
        )
        modelo.fit(X_train, y_train)

        accuracy = round(modelo.score(X_test, y_test), 4)
        self._modelo_prioridad = modelo

        importancias = dict(zip(feature_cols, [round(float(i), 4) for i in modelo.feature_importances_]))

        logger.info("Modelo Prioridad entrenado — Accuracy: %.4f", accuracy)

        return {
            "accuracy": accuracy,
            "samples_train": len(X_train),
            "samples_test": len(X_test),
            "clases": list(y.unique()),
            "importancia_features": importancias,
        }

    # ============================================================
    # MÉTODOS PRIVADOS: PERSISTENCIA DE MODELOS
    # ============================================================

    def _guardar_modelos(self) -> None:
        """Serializa los modelos entrenados a disco como archivos .pkl."""
        if self._modelo_estado is not None:
            path_estado = self._models_dir / NOMBRE_MODELO_ESTADO
            joblib.dump(self._modelo_estado, path_estado)
            logger.info("Modelo Estado guardado en: %s", path_estado)

        if self._modelo_prioridad is not None:
            path_prioridad = self._models_dir / NOMBRE_MODELO_PRIORIDAD
            joblib.dump(self._modelo_prioridad, path_prioridad)
            logger.info("Modelo Prioridad guardado en: %s", path_prioridad)

    def _cargar_modelos(self) -> None:
        """Carga modelos previamente entrenados desde disco."""
        path_estado = self._models_dir / NOMBRE_MODELO_ESTADO
        if path_estado.exists():
            try:
                self._modelo_estado = joblib.load(path_estado)
                logger.info("Modelo Estado cargado desde: %s", path_estado)
            except Exception as error:
                logger.warning("Error cargando modelo Estado: %s", error)

        path_prioridad = self._models_dir / NOMBRE_MODELO_PRIORIDAD
        if path_prioridad.exists():
            try:
                self._modelo_prioridad = joblib.load(path_prioridad)
                logger.info("Modelo Prioridad cargado desde: %s", path_prioridad)
            except Exception as error:
                logger.warning("Error cargando modelo Prioridad: %s", error)

    # ============================================================
    # MÉTODOS PRIVADOS: FEATURES DE PREDICCIÓN
    # ============================================================

    def _extraer_features_prediccion(self, datos: Dict[str, Any]) -> Dict[str, float]:
        """
        Extrae features numéricas de un trámite para la predicción.

        Transforma los datos crudos del trámite al mismo formato
        que se usó en el entrenamiento.
        """
        accion = datos.get("ultima_accion", datos.get("accion", "INICIO_PROCESO"))
        tiempo = float(datos.get("tiempo_en_nodo", datos.get("tiempo_actual", 0)))
        semaforizacion = datos.get("semaforizacion", "Verde")
        historial_len = int(datos.get("cantidad_pasos", datos.get("total_transiciones", 0)))

        semaforo_map = {"Verde": 0, "Amarillo": 1, "Rojo": 2}

        return {
            "accion_encoded": float(ACCIONES_ENCODING.get(accion, len(ACCIONES_ENCODING))),
            "tiempo_en_nodo": tiempo,
            "tiene_detalle_ia": 1.0,
            "cantidad_campos": float(datos.get("cantidad_campos", 0)),
            "semaforo_encoded": float(semaforo_map.get(semaforizacion, 0)),
            "cantidad_pasos_historial": float(historial_len),
        }

    # ============================================================
    # MÉTODOS PRIVADOS: DECODIFICACIÓN Y RECOMENDACIONES
    # ============================================================

    @staticmethod
    def _decodificar_estado(valor: int) -> str:
        """Convierte un valor numérico codificado de vuelta al nombre del estado."""
        inverso = {v: k for k, v in ESTADOS_ENCODING.items()}
        return inverso.get(valor, "desconocido")

    @staticmethod
    def _decodificar_prioridad(valor: int) -> str:
        """Convierte un valor numérico codificado de vuelta al nombre de la prioridad."""
        inverso = {v: k for k, v in PRIORIDADES_ENCODING.items()}
        return inverso.get(valor, "Media")

    @staticmethod
    def _generar_recomendacion_ml(resultado: Dict[str, Any]) -> str:
        """
        Genera una recomendación en lenguaje natural basada en las predicciones.

        Evalúa el estado y la prioridad para dar un consejo accionable.
        """
        estado = resultado.get("estado_predicho", "")
        prioridad = resultado.get("prioridad_recomendada", "")
        confianza = resultado.get("confianza_estado", 0)

        if prioridad == "Alta" and confianza > 0.7:
            return (
                "🚨 Este trámite tiene ALTA probabilidad de requerir atención urgente. "
                "Se recomienda asignar un funcionario dedicado y establecer alertas."
            )
        if estado == "observado":
            return (
                "⚠️ El modelo predice que este trámite será OBSERVADO. "
                "Verifique la documentación del cliente y anticipe correcciones."
            )
        if estado == "finalizado" and confianza > 0.8:
            return (
                "✅ El trámite tiene alta probabilidad de finalizar exitosamente. "
                "Mantener el seguimiento normal."
            )
        if estado == "rechazado":
            return (
                "❌ El modelo detecta un patrón similar a trámites RECHAZADOS. "
                "Revisar documentación y requisitos antes de avanzar."
            )

        return (
            "📊 Predicción completada. Monitoree el trámite según los indicadores habituales."
        )

    # ============================================================
    # MÉTODO PRIVADO: REGISTRAR EN BASE_CONOCIMIENTO_IA
    # ============================================================

    def _registrar_conocimiento(self, resultado: Dict[str, Any]) -> None:
        """
        Guarda las métricas del entrenamiento en la colección Base_Conocimiento_IA
        de MongoDB, creando un registro histórico de cada modelo entrenado.
        """
        if self._db is None:
            return

        try:
            conocimiento = {
                "contexto_aprendizaje": "prediccion_estado_prioridad",
                "fecha_entrenamiento": datetime.now(),
                "resultado_exitoso": resultado.get("status") == "entrenado",
                "modelo_estado": resultado.get("modelo_estado", {}),
                "modelo_prioridad": resultado.get("modelo_prioridad", {}),
                "total_registros": resultado.get("total_registros_bitacora", 0),
                "vector_id": str(self._models_dir),
                "empresa_id": "global",
            }
            self._db["Base_Conocimiento_IA"].insert_one(conocimiento)
            logger.info("Conocimiento registrado en Base_Conocimiento_IA")
        except Exception as error:
            logger.warning("Error registrando conocimiento: %s", error)
