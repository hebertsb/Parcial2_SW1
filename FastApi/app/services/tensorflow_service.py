"""
NexusFlow AI - Motor Deep Learning con TensorFlow (Segundo Parcial)
====================================================================
Implementa tres modelos de deep learning sobre datos de la Bitácora:

1. LSTM Route Predictor  — predice el siguiente nodo en el flujo
2. Dense Delay Risk      — probabilidad de demora (0-1)
3. Autoencoder Anomaly   — detecta trámites anómalos por error de reconstrucción

Datos: colección Bitácora de MongoDB (nexusflow_oficial)
Framework: TensorFlow 2.x / Keras
"""

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

import numpy as np
from pymongo import MongoClient

from ..config import settings

logger = logging.getLogger(__name__)

# ── Directorio de modelos ──────────────────────────────────────
TF_MODELS_DIR = Path(settings.ml_models_dir) / "tensorflow"
TF_MODELS_DIR.mkdir(parents=True, exist_ok=True)

# Rutas de archivos
ROUTE_MODEL_PATH    = TF_MODELS_DIR / "lstm_route.keras"
RISK_MODEL_PATH     = TF_MODELS_DIR / "dense_risk.keras"
ANOMALY_MODEL_PATH  = TF_MODELS_DIR / "autoencoder_anomaly.keras"
METADATA_PATH       = TF_MODELS_DIR / "metadata.json"

# ── Mapeos de acciones y estados ──────────────────────────────
ACCIONES = [
    "INICIO_PROCESO", "LLENADO_FORMULARIO", "APROBAR",
    "OBSERVAR", "RECHAZAR", "ESCALAR", "SUBIDA_EVIDENCIA", "FINALIZAR"
]
ESTADOS = [
    "pendiente", "en_proceso", "en_revision", "observado",
    "escalado", "finalizado", "rechazado", "vencido"
]
ACCION_IDX = {a: i for i, a in enumerate(ACCIONES)}
ESTADO_IDX  = {e: i for i, e in enumerate(ESTADOS)}

# Políticas conocidas — índice para feature encoding
POL_IDS = [
    "POL-CREDITO",
    "69e5761c86717357fbe4a96e",
    "69f0f96a1b4f1009733012c7",
    "69f3c15e806aa96df48515a6",
    "69f3c15e806aa96df48515a7",
    "69f3c15e806aa96df48515a8",
]
POL_IDX = {p: i for i, p in enumerate(POL_IDS)}

# Longitud de secuencia para LSTM
SEQ_LEN = 5
# Token de padding — distinto de 0 (INICIO_PROCESO) para evitar ambigüedad
PADDING_TOKEN = len(ACCIONES)  # valor 8, fuera del rango 0-7
# Dimensión de features para risk y anomaly
FEATURE_DIM = 6


def _get_mongo_collection():
    """Conecta a MongoDB y retorna la colección Bitácora."""
    client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)
    db = client[settings.mongodb_database]
    return db["Bitacora"]


def _encode_accion(accion: str) -> int:
    return ACCION_IDX.get(accion, len(ACCIONES) - 1)


def _encode_estado(estado: str) -> int:
    return ESTADO_IDX.get(estado, 0)


def _extract_features(doc: dict) -> np.ndarray:
    """Extrae vector de features de un documento de Bitácora."""
    detalle = doc.get("detalle_ia", {}) or {}
    tiempo = float(detalle.get("tiempo_en_nodo", 0.0))
    campos = float(detalle.get("campos_configurados", 0))
    documentos = float(detalle.get("numero_documentos", 0))

    fecha = doc.get("fecha_hora") or doc.get("fecha")
    hora = float(fecha.hour) if hasattr(fecha, "hour") else 12.0
    dia = float(fecha.weekday()) if hasattr(fecha, "weekday") else 1.0

    accion_enc = float(_encode_accion(doc.get("accion", "")))

    return np.array([tiempo, campos, documentos, hora, dia, accion_enc], dtype=np.float32)


def _normalizar(X: np.ndarray) -> tuple:
    """Normalización min-max simple."""
    X_min = X.min(axis=0)
    X_max = X.max(axis=0)
    rango = X_max - X_min
    rango[rango == 0] = 1.0
    return (X - X_min) / rango, X_min, X_max


class TensorFlowService:
    """
    Motor de deep learning de NexusFlow.
    Gestiona entrenamiento, carga y predicción de los 3 modelos TF.
    """

    def __init__(self):
        self._route_model = None
        self._risk_model  = None
        self._anomaly_model = None
        self._metadata: dict = {}
        self._tf_disponible = False

        try:
            import tensorflow as tf
            self._tf = tf
            self._tf_disponible = True
            logger.info("TensorFlow %s cargado correctamente", tf.__version__)
            self._cargar_modelos_existentes()
        except ImportError:
            logger.warning("TensorFlow no instalado — deep learning deshabilitado")

    # ── Carga de modelos guardados ─────────────────────────────

    def _cargar_modelos_existentes(self) -> None:
        if ROUTE_MODEL_PATH.exists():
            try:
                self._route_model = self._tf.keras.models.load_model(str(ROUTE_MODEL_PATH))
                logger.info("LSTM route predictor cargado")
            except Exception as e:
                logger.warning("Error cargando LSTM: %s", e)

        if RISK_MODEL_PATH.exists():
            try:
                self._risk_model = self._tf.keras.models.load_model(str(RISK_MODEL_PATH))
                logger.info("Dense risk model cargado")
            except Exception as e:
                logger.warning("Error cargando risk model: %s", e)

        if ANOMALY_MODEL_PATH.exists():
            try:
                self._anomaly_model = self._tf.keras.models.load_model(str(ANOMALY_MODEL_PATH))
                logger.info("Autoencoder anomaly cargado")
            except Exception as e:
                logger.warning("Error cargando autoencoder: %s", e)

        if METADATA_PATH.exists():
            with open(METADATA_PATH, "r") as f:
                self._metadata = json.load(f)

    # ── Entrenamiento completo ────────────────────────────────

    def entrenar(self) -> Dict[str, Any]:
        """Entrena los 3 modelos desde la Bitácora. Retorna métricas."""
        if not self._tf_disponible:
            return {"error": "TensorFlow no disponible", "estado": "sin_tf"}

        try:
            registros = list(_get_mongo_collection().find({}).sort("fecha", 1))
        except Exception as e:
            return {"error": f"MongoDB no disponible: {e}", "estado": "error_db"}

        if len(registros) < 10:
            return {
                "error": f"Datos insuficientes: {len(registros)} registros (mínimo 10)",
                "estado": "insuficiente"
            }

        logger.info("Entrenando modelos TF con %d registros...", len(registros))

        metricas = {}
        metricas.update(self._entrenar_lstm_route(registros))
        metricas.update(self._entrenar_dense_risk(registros))
        metricas.update(self._entrenar_autoencoder(registros))

        self._metadata["ultimo_entrenamiento"] = datetime.now().isoformat()
        self._metadata["total_registros"] = len(registros)
        with open(METADATA_PATH, "w") as f:
            json.dump(self._metadata, f)

        return {
            "estado": "entrenado",
            "total_registros": len(registros),
            "metricas": metricas,
            "timestamp": self._metadata["ultimo_entrenamiento"]
        }

    def _entrenar_lstm_route(self, registros: list) -> dict:
        """Modelo 1: LSTM que predice la siguiente acción en un flujo.

        Input shape: (SEQ_LEN, 2) — [accion_norm, politica_norm]
        Padding token = PADDING_TOKEN (8), distinto de INICIO_PROCESO (0).
        """
        tf = self._tf
        n_acciones = len(ACCIONES)
        n_pols = max(len(POL_IDS) - 1, 1)

        # Agrupar por tramite_id
        tramites: Dict[str, list] = {}
        for doc in registros:
            tid = doc.get("tramite_id", "unknown")
            tramites.setdefault(tid, []).append(doc)

        X_seqs, y_labels = [], []
        for docs in tramites.values():
            if len(docs) < 2:
                continue
            pol_id = docs[0].get("politica_id", "")
            pol_norm = POL_IDX.get(pol_id, -1)
            pol_feat = pol_norm / n_pols if pol_norm >= 0 else 0.5

            encoded = [_encode_accion(d.get("accion", "")) for d in docs]
            for i in range(len(encoded) - 1):
                start = max(0, i + 1 - SEQ_LEN)
                seq = encoded[start:i + 1]
                n_pad = SEQ_LEN - len(seq)
                # Padding como token 8 (PADDING_TOKEN), normalizado = 8/8 = 1.0
                pad_rows  = [[PADDING_TOKEN / n_acciones, pol_feat]] * n_pad
                seq_rows  = [[a / n_acciones, pol_feat] for a in seq]
                X_seqs.append(pad_rows + seq_rows)
                y_labels.append(encoded[i + 1])

        if len(X_seqs) < 5:
            logger.warning("LSTM: pocas secuencias (%d), usando datos sintéticos", len(X_seqs))
            X_seqs = [[[np.random.randint(0, n_acciones) / n_acciones, 0.5]
                        for _ in range(SEQ_LEN)] for _ in range(30)]
            y_labels = np.random.randint(0, n_acciones, 30).tolist()

        X = np.array(X_seqs, dtype=np.float32)   # (N, SEQ_LEN, 2)
        y = np.array(y_labels, dtype=np.int32)

        counts = np.bincount(y, minlength=n_acciones)
        counts = np.where(counts == 0, 1, counts)
        max_count = counts.max()
        class_weight = {i: float(max_count) / float(counts[i]) for i in range(n_acciones)}

        model = tf.keras.Sequential([
            tf.keras.layers.LSTM(128, input_shape=(SEQ_LEN, 2), return_sequences=True),
            tf.keras.layers.Dropout(0.2),
            tf.keras.layers.LSTM(64, return_sequences=False),
            tf.keras.layers.Dropout(0.2),
            tf.keras.layers.Dense(64, activation="relu"),
            tf.keras.layers.Dense(n_acciones, activation="softmax")
        ], name="lstm_route_predictor")

        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
            loss="sparse_categorical_crossentropy",
            metrics=["accuracy"]
        )

        tf.random.set_seed(42)
        np.random.seed(42)

        hist = model.fit(
            X, y,
            epochs=35,
            batch_size=32,
            verbose=0,
            validation_split=0.2,
            class_weight=class_weight,
        )
        model.save(str(ROUTE_MODEL_PATH))
        self._route_model = model

        acc = float(hist.history.get("accuracy", [0])[-1])
        val_acc = float(max(hist.history.get("val_accuracy", [0])))
        self._metadata["lstm_accuracy"] = acc
        self._metadata["lstm_input_features"] = 2
        logger.info("LSTM entrenado — accuracy: %.3f, best_val: %.3f", acc, val_acc)
        return {"lstm_accuracy": acc, "lstm_val_accuracy": val_acc, "lstm_secuencias": len(X_seqs)}

    def _entrenar_dense_risk(self, registros: list) -> dict:
        """Modelo 2: Red densa que predice riesgo de demora (0-1)."""
        tf = self._tf

        X_list, y_list = [], []
        for doc in registros:
            feats = _extract_features(doc)
            estado = doc.get("estado", "")
            label = 1.0 if estado in ("observado", "rechazado", "vencido", "escalado") else 0.0
            X_list.append(feats)
            y_list.append(label)

        # Siempre agrega datos sintéticos correctamente correlacionados
        # Casos ALTO RIESGO (label=1): tiempo alto, hora nocturna, fin de semana, 0 docs, rechazado
        for _ in range(150):
            t = np.random.uniform(60, 200)       # 60-200 horas atascado
            c = np.random.randint(0, 2)           # 0-1 campos
            d = np.random.randint(0, 2)           # 0-1 documentos
            h = np.random.uniform(20, 23)         # noche
            w = np.random.choice([5, 6])          # fin de semana
            a = float(np.random.choice([_encode_accion("RECHAZAR"), _encode_accion("OBSERVAR")]))
            X_list.append(np.array([t, c, d, h, w, a], dtype=np.float32))
            y_list.append(1.0)

        # Casos BAJO RIESGO (label=0): tiempo bajo, horario normal, documentos ok, aprobado
        for _ in range(150):
            t = np.random.uniform(0, 24)          # <24 horas en nodo
            c = np.random.randint(3, 10)          # campos completos
            d = np.random.randint(2, 6)           # documentos adjuntos
            h = np.random.uniform(8, 17)          # horario laboral
            w = np.random.choice([0, 1, 2, 3, 4]) # día de semana
            a = float(np.random.choice([_encode_accion("APROBAR"), _encode_accion("FINALIZAR"), _encode_accion("LLENADO_FORMULARIO")]))
            X_list.append(np.array([t, c, d, h, w, a], dtype=np.float32))
            y_list.append(0.0)

        # Casos RIESGO MEDIO: mezclados
        for _ in range(50):
            t = np.random.uniform(24, 60)
            c = np.random.randint(1, 4)
            d = np.random.randint(0, 3)
            h = np.random.uniform(17, 22)
            w = np.random.randint(0, 7)
            a = float(_encode_accion("OBSERVAR"))
            X_list.append(np.array([t, c, d, h, w, a], dtype=np.float32))
            y_list.append(1.0)

        X = np.array(X_list, dtype=np.float32)
        y = np.array(y_list, dtype=np.float32)

        # Normalización — guardamos rangos para inference
        X_min = X.min(axis=0)
        X_max = X.max(axis=0)
        rango = X_max - X_min
        rango[rango == 0] = 1.0
        X_norm = np.clip((X - X_min) / rango, 0.0, 1.0)

        self._metadata["risk_X_min"] = X_min.tolist()
        self._metadata["risk_X_max"] = X_max.tolist()

        model = tf.keras.Sequential([
            tf.keras.layers.Dense(64, activation="relu", input_shape=(FEATURE_DIM,)),
            tf.keras.layers.Dropout(0.3),
            tf.keras.layers.Dense(32, activation="relu"),
            tf.keras.layers.Dropout(0.2),
            tf.keras.layers.Dense(16, activation="relu"),
            tf.keras.layers.Dense(1, activation="sigmoid")
        ], name="dense_delay_risk")

        model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])

        # class_weight balanceado
        n_pos = int(y.sum())
        n_neg = len(y) - n_pos
        class_weight = {0: 1.0, 1: max(1.0, n_neg / max(n_pos, 1))}

        hist = model.fit(
            X_norm, y, epochs=50, batch_size=32, verbose=0,
            validation_split=0.2, class_weight=class_weight
        )
        model.save(str(RISK_MODEL_PATH))
        self._risk_model = model

        acc = float(hist.history.get("accuracy", [0])[-1])
        val_acc = float(hist.history.get("val_accuracy", [0])[-1])
        logger.info("Dense risk entrenado — accuracy: %.3f, val: %.3f, dataset: %d", acc, val_acc, len(X))
        return {"risk_accuracy": acc, "risk_val_accuracy": val_acc, "risk_registros": len(X_list)}

    def _entrenar_autoencoder(self, registros: list) -> dict:
        """Modelo 3: Autoencoder para detección de anomalías."""
        tf = self._tf

        X_list = [_extract_features(doc) for doc in registros]
        if len(X_list) < 5:
            X_list = np.random.rand(30, FEATURE_DIM).tolist()

        X = np.array(X_list, dtype=np.float32)
        X_norm, X_min, X_max = _normalizar(X)
        self._metadata["ae_X_min"] = X_min.tolist()
        self._metadata["ae_X_max"] = X_max.tolist()

        # Arquitectura autoencoder
        encoder = tf.keras.Sequential([
            tf.keras.layers.Dense(8, activation="relu", input_shape=(FEATURE_DIM,)),
            tf.keras.layers.Dense(4, activation="relu"),
        ], name="encoder")

        decoder = tf.keras.Sequential([
            tf.keras.layers.Dense(8, activation="relu", input_shape=(4,)),
            tf.keras.layers.Dense(FEATURE_DIM, activation="linear"),
        ], name="decoder")

        inputs = tf.keras.Input(shape=(FEATURE_DIM,))
        encoded = encoder(inputs)
        decoded = decoder(encoded)
        autoencoder = tf.keras.Model(inputs, decoded, name="autoencoder_anomaly")
        autoencoder.compile(optimizer="adam", loss="mse")

        hist = autoencoder.fit(X_norm, X_norm, epochs=50, batch_size=16, verbose=0, validation_split=0.1)
        autoencoder.save(str(ANOMALY_MODEL_PATH))
        self._anomaly_model = autoencoder

        # Calcular umbral de error normal (media + 2 std sobre datos de entrenamiento)
        recon = autoencoder.predict(X_norm, verbose=0)
        errores = np.mean(np.square(X_norm - recon), axis=1)
        umbral = float(np.mean(errores) + 2 * np.std(errores))
        self._metadata["anomaly_threshold"] = umbral
        self._metadata["anomaly_error_mean"] = float(np.mean(errores))

        val_loss = float(hist.history.get("val_loss", [0])[-1])
        logger.info("Autoencoder entrenado — val_loss: %.4f, umbral anomalía: %.4f", val_loss, umbral)
        return {"ae_val_loss": val_loss, "ae_umbral": umbral, "ae_registros": len(X_list)}

    # ── Predicciones ────────────────────────────────────────────

    def _intentar_recargar(self) -> None:
        """Recarga modelos desde disco si no están en memoria (multi-worker safe)."""
        if self._route_model is None and ROUTE_MODEL_PATH.exists():
            try:
                self._route_model = self._tf.keras.models.load_model(str(ROUTE_MODEL_PATH))
                logger.info("LSTM recargado desde disco")
            except Exception as e:
                logger.warning("Error recargando LSTM: %s", e)
        if self._risk_model is None and RISK_MODEL_PATH.exists():
            try:
                self._risk_model = self._tf.keras.models.load_model(str(RISK_MODEL_PATH))
                logger.info("Risk model recargado desde disco")
            except Exception as e:
                logger.warning("Error recargando risk model: %s", e)
        if self._anomaly_model is None and ANOMALY_MODEL_PATH.exists():
            try:
                self._anomaly_model = self._tf.keras.models.load_model(str(ANOMALY_MODEL_PATH))
                logger.info("Autoencoder recargado desde disco")
            except Exception as e:
                logger.warning("Error recargando autoencoder: %s", e)
        if METADATA_PATH.exists() and not self._metadata:
            with open(METADATA_PATH, "r") as f:
                self._metadata = json.load(f)

    def predecir_ruta(self, secuencia_acciones: List[str],
                      politica_id: Optional[str] = None) -> Dict[str, Any]:
        """Predice la siguiente acción más probable dado el historial."""
        if not self._tf_disponible:
            return {"error": "TensorFlow no disponible"}
        self._intentar_recargar()
        if self._route_model is None:
            return {"error": "Modelo LSTM no entrenado. Llama a /tf/entrenar primero."}

        n_acciones = len(ACCIONES)
        n_pols = max(len(POL_IDS) - 1, 1)
        pol_norm = POL_IDX.get(politica_id, -1)
        pol_feat = pol_norm / n_pols if pol_norm >= 0 else 0.5

        encoded = [_encode_accion(a) for a in secuencia_acciones][-SEQ_LEN:]
        n_pad = SEQ_LEN - len(encoded)
        pad_rows = [[PADDING_TOKEN / n_acciones, pol_feat]] * n_pad
        seq_rows = [[a / n_acciones, pol_feat] for a in encoded]
        X = np.array([pad_rows + seq_rows], dtype=np.float32)  # (1, SEQ_LEN, 2)

        probs = self._route_model.predict(X, verbose=0)[0]
        idx_max = int(np.argmax(probs))
        confianza = float(probs[idx_max])

        return {
            "siguiente_accion": ACCIONES[idx_max],
            "confianza": round(confianza, 4),
            "distribucion": {ACCIONES[i]: round(float(p), 4) for i, p in enumerate(probs)},
            "secuencia_entrada": secuencia_acciones,
            "politica_id": politica_id
        }

    def predecir_riesgo_demora(self, features: Dict[str, float]) -> Dict[str, Any]:
        """Predice probabilidad de demora para un trámite actual."""
        if not self._tf_disponible:
            return {"error": "TensorFlow no disponible"}
        self._intentar_recargar()
        if self._risk_model is None:
            return {"error": "Modelo de riesgo no entrenado. Llama a /tf/entrenar primero."}

        X_raw = np.array([[
            features.get("tiempo_en_nodo", 0.0),
            features.get("campos_configurados", 0.0),
            features.get("numero_documentos", 0.0),
            features.get("hora_dia", 12.0),
            features.get("dia_semana", 1.0),
            float(_encode_accion(features.get("ultima_accion", ""))),
        ]], dtype=np.float32)

        # Normalizar con parámetros del entrenamiento
        X_min = np.array(self._metadata.get("risk_X_min", [0] * FEATURE_DIM))
        X_max = np.array(self._metadata.get("risk_X_max", [1] * FEATURE_DIM))
        rango = X_max - X_min
        rango[rango == 0] = 1.0
        X_norm = np.clip((X_raw - X_min) / rango, 0.0, 1.0)

        prob = float(self._risk_model.predict(X_norm, verbose=0)[0][0])
        nivel = "CRÍTICO" if prob > 0.75 else "ALTO" if prob > 0.5 else "MEDIO" if prob > 0.25 else "BAJO"

        return {
            "probabilidad_demora": round(prob, 4),
            "nivel_riesgo": nivel,
            "recomendacion": _recomendacion_riesgo(nivel),
            "features_usadas": features
        }

    def detectar_anomalia(self, features: Dict[str, float]) -> Dict[str, Any]:
        """Detecta si un trámite es anómalo usando el autoencoder."""
        if not self._tf_disponible:
            return {"error": "TensorFlow no disponible"}
        self._intentar_recargar()
        if self._anomaly_model is None:
            return {"error": "Autoencoder no entrenado. Llama a /tf/entrenar primero."}

        X_raw = np.array([[
            features.get("tiempo_en_nodo", 0.0),
            features.get("campos_configurados", 0.0),
            features.get("numero_documentos", 0.0),
            features.get("hora_dia", 12.0),
            features.get("dia_semana", 1.0),
            float(_encode_accion(features.get("ultima_accion", ""))),
        ]], dtype=np.float32)

        X_min = np.array(self._metadata.get("ae_X_min", [0] * FEATURE_DIM))
        X_max = np.array(self._metadata.get("ae_X_max", [1] * FEATURE_DIM))
        rango = X_max - X_min
        rango[rango == 0] = 1.0
        X_norm = (X_raw - X_min) / rango

        recon = self._anomaly_model.predict(X_norm, verbose=0)
        error = float(np.mean(np.square(X_norm - recon)))
        umbral = self._metadata.get("anomaly_threshold", 0.5)
        es_anomalia = error > umbral

        return {
            "es_anomalia": es_anomalia,
            "score_anomalia": round(error, 6),
            "umbral": round(float(umbral), 6),
            "nivel": "ANÓMALO" if es_anomalia else "NORMAL",
            "descripcion": (
                f"Error de reconstrucción {error:.4f} supera el umbral {umbral:.4f}. Trámite requiere revisión."
                if es_anomalia else
                f"Trámite dentro de parámetros normales (error {error:.4f} < umbral {umbral:.4f})."
            )
        }

    def estado(self) -> Dict[str, Any]:
        """Retorna estado de todos los modelos TF."""
        return {
            "tensorflow_disponible": self._tf_disponible,
            "tensorflow_version": self._tf.__version__ if self._tf_disponible else None,
            "modelos": {
                "lstm_route": self._route_model is not None,
                "dense_risk": self._risk_model is not None,
                "autoencoder_anomaly": self._anomaly_model is not None,
            },
            "ultimo_entrenamiento": self._metadata.get("ultimo_entrenamiento"),
            "total_registros_entrenamiento": self._metadata.get("total_registros", 0),
            "metricas": {
                "lstm_accuracy": self._metadata.get("lstm_accuracy"),
                "anomaly_threshold": self._metadata.get("anomaly_threshold"),
            }
        }


def _recomendacion_riesgo(nivel: str) -> str:
    return {
        "CRÍTICO": "Intervención inmediata requerida. Reasignar a funcionario senior.",
        "ALTO": "Revisar este trámite en las próximas 2 horas para evitar vencimiento.",
        "MEDIO": "Monitorear. Puede requerir intervención si no avanza en 24 horas.",
        "BAJO": "Trámite en tiempo normal. Sin acción requerida.",
    }.get(nivel, "Sin recomendación.")


# Singleton
_tf_service_instance: Optional[TensorFlowService] = None


def get_tf_service() -> TensorFlowService:
    global _tf_service_instance
    if _tf_service_instance is None:
        _tf_service_instance = TensorFlowService()
    return _tf_service_instance
