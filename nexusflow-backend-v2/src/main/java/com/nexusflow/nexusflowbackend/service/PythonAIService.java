package com.nexusflow.nexusflowbackend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/**
 * Servicio puente entre Spring Boot y el microservicio de IA en FastAPI (Python).
 * Todas las llamadas a la IA pasan por este servicio centralizado.
 *
 * Endpoints FastAPI consumidos:
 *   - POST /ia/generar-diagrama    → Generación de diagramas con GPT
 *   - POST /voz/transcribir        → Transcripción de audio con Whisper
 *   - POST /analytics/cuellos-botella → Análisis con IA avanzada
 *   - POST /asistente/ayuda        → Asistente contextual
 */
@Service
public class PythonAIService {

    @Value("${fastapi.url:http://localhost:8000}")
    private String fastapiUrl;

    @Value("${fastapi.timeout:30000}")
    private int timeout;

    private final RestTemplate restTemplate;

    public PythonAIService() {
        this.restTemplate = new RestTemplate();
    }

    // ============================================================
    // MÉTODO 1: GENERAR DIAGRAMA CON IA
    // ============================================================
    /**
     * Llama a FastAPI para generar un diagrama de actividad desde lenguaje natural.
     *
     * @param descripcion Descripción del flujo en lenguaje natural
     * @param empresaId   ID de la empresa
     * @return Mapa con nombre, nodos, enlaces y descripcion del diagrama
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> generarDiagrama(String descripcion, String empresaId) {
        String url = fastapiUrl + "/ia/generar-diagrama";

        Map<String, String> body = new HashMap<>();
        body.put("descripcion", descripcion);
        body.put("empresaId", empresaId);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(url, body, Map.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                System.out.println("✅ [IA] Diagrama generado exitosamente desde FastAPI");
                return response.getBody();
            }
        } catch (Exception e) {
            System.out.println("⚠️ [IA] Error conectando con FastAPI: " + e.getMessage());
            System.out.println("⚠️ [IA] Usando diagrama local de respaldo...");
        }

        // Fallback: si FastAPI no está disponible, devolver diagrama básico
        return generarDiagramaLocal(descripcion);
    }

    // ============================================================
    // MÉTODO 2: TRANSCRIBIR AUDIO CON IA
    // ============================================================
    /**
     * Llama a FastAPI para transcribir audio a texto usando Whisper.
     *
     * @param audioBase64 Audio codificado en Base64
     * @param formato     Formato del audio (wav, mp3, webm)
     * @param tramiteId   ID del trámite
     * @param campoId     ID del campo del formulario
     * @return Mapa con texto transcrito y entidades extraídas
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> transcribirAudio(String audioBase64, String formato,
                                                 String tramiteId, String campoId) {
        String url = fastapiUrl + "/voz/transcribir";

        Map<String, String> body = new HashMap<>();
        body.put("audioBase64", audioBase64);
        body.put("formato", formato);
        body.put("tramiteId", tramiteId);
        body.put("campoId", campoId);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(url, body, Map.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                System.out.println("✅ [VOZ] Audio transcrito exitosamente desde FastAPI");
                return response.getBody();
            }
        } catch (Exception e) {
            System.out.println("⚠️ [VOZ] Error conectando con FastAPI: " + e.getMessage());
            System.out.println("⚠️ [VOZ] Usando transcripción simulada...");
        }

        // Fallback: el servicio FastAPI no está disponible
        Map<String, Object> fallback = new HashMap<>();
        fallback.put("error", "El servicio de transcripción de voz no está disponible. Verifica que FastAPI esté activo.");
        fallback.put("texto", "");
        if (campoId != null) fallback.put("campoId", campoId);
        if (tramiteId != null) fallback.put("tramiteId", tramiteId);
        return fallback;
    }

    // ============================================================
    // MÉTODO 3: ANALÍTICA CON IA AVANZADA
    // ============================================================
    /**
     * Llama a FastAPI para obtener recomendaciones inteligentes de optimización.
     *
     * @param empresaId      ID de la empresa
     * @param tiemposPorNodo Mapa de nodoId → tiempo promedio en horas
     * @return Mapa con cuellos de botella y recomendaciones de la IA
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> analizarConIA(String empresaId, Map<String, Double> tiemposPorNodo) {
        String url = fastapiUrl + "/analytics/cuellos-botella";

        Map<String, Object> body = new HashMap<>();
        body.put("empresaId", empresaId);
        body.put("tiemposPorNodo", tiemposPorNodo);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(url, body, Map.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                System.out.println("✅ [ANALYTICS] Análisis IA completado desde FastAPI");
                return response.getBody();
            }
        } catch (Exception e) {
            System.out.println("⚠️ [ANALYTICS] Error conectando con FastAPI: " + e.getMessage());
        }

        return Map.of("mensaje", "Servicio de IA no disponible");
    }

    // ============================================================
    // MÉTODO 4: ASISTENTE CONTEXTUAL
    // ============================================================
    /**
     * Llama a FastAPI para obtener ayuda contextual del asistente de IA.
     *
     * @param mensaje        Consulta del usuario
     * @param rolUsuario     Rol actual del usuario
     * @param contextoActual Pantalla/acción actual (puede ser null)
     * @return Mapa con respuesta y sugerencias
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> obtenerAyuda(String mensaje, String rolUsuario, String contextoActual) {
        String url = fastapiUrl + "/asistente/ayuda";

        Map<String, String> body = new HashMap<>();
        body.put("mensaje", mensaje);
        body.put("rolUsuario", rolUsuario);
        if (contextoActual != null) {
            body.put("contextoActual", contextoActual);
        }

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(url, body, Map.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                return response.getBody();
            }
        } catch (Exception e) {
            System.out.println("⚠️ [ASISTENTE] Error conectando con FastAPI: " + e.getMessage());
        }

        return Map.of(
                "respuesta", "El asistente de IA no está disponible en este momento.",
                "sugerencias", java.util.List.of("Verifica que el servicio FastAPI esté activo")
        );
    }

    // ============================================================
    // MÉTODO 5: EXTRAER ENTIDADES DE TEXTO
    // ============================================================
    /**
     * Extrae entidades (montos, fechas, nombres) de un texto.
     * Se usa después de la transcripción de voz.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> extraerEntidades(String texto) {
        // Usar transcripción con texto directo para extraer entidades
        Map<String, Object> resultado = new HashMap<>();
        resultado.put("texto", texto);
        // Las entidades vienen incluidas en la respuesta de /voz/transcribir
        return resultado;
    }

    // ============================================================
    // MÉTODO 6: HEALTH CHECK
    // ============================================================
    /**
     * Verifica si el servicio FastAPI está activo.
     */
    public boolean isServiceAvailable() {
        try {
            ResponseEntity<Map> response = restTemplate.getForEntity(
                    fastapiUrl + "/health", Map.class
            );
            return response.getStatusCode() == HttpStatus.OK;
        } catch (Exception e) {
            return false;
        }
    }

    // ============================================================
    // FALLBACK LOCAL: Diagrama básico
    // ============================================================
    private Map<String, Object> generarDiagramaLocal(String descripcion) {
        Map<String, Object> diagrama = new HashMap<>();
        diagrama.put("nombre", "Diagrama generado: " + descripcion.substring(0, Math.min(30, descripcion.length())));

        var nodos = java.util.List.of(
                Map.of("id", "n1", "nombre", "Inicio del proceso", "tipo", "NODO_INICIO", "unidad", "CLIENTE"),
                Map.of("id", "n2", "nombre", "Procesar solicitud", "tipo", "TASK", "unidad", "PROCESAMIENTO"),
                Map.of("id", "n3", "nombre", "Fin del proceso", "tipo", "NODO_FIN", "unidad", "SISTEMA")
        );
        diagrama.put("nodos", nodos);

        var enlaces = java.util.List.of(
                Map.of("from", "n1", "to", "n2"),
                Map.of("from", "n2", "to", "n3")
        );
        diagrama.put("enlaces", enlaces);
        diagrama.put("descripcion", "Diagrama generado localmente (FastAPI no disponible)");

        return diagrama;
    }

    // ============================================================
    // MÉTODO 7: ENTRENAR MODELO ML DESDE LA BITÁCORA
    // ============================================================
    /**
     * Llama a FastAPI para entrenar modelos de ML desde la Bitácora de MongoDB.
     *
     * El modelo aprende patrones de los procesos históricos para predecir
     * el estado y la prioridad de trámites futuros.
     *
     * @return Mapa con métricas del entrenamiento (accuracy, samples, status)
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> entrenarModelo() {
        String url = fastapiUrl + "/ia/entrenar";

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(url, null, Map.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                System.out.println("✅ [ML] Modelo entrenado exitosamente desde FastAPI");
                return response.getBody();
            }
        } catch (Exception e) {
            System.out.println("⚠️ [ML] Error entrenando modelo: " + e.getMessage());
        }

        return Map.of(
                "status", "error",
                "mensaje", "No se pudo conectar con el servicio de ML en FastAPI"
        );
    }

    // ============================================================
    // MÉTODO 8: PREDECIR PRIORIDAD Y ESTADO DE UN TRÁMITE
    // ============================================================
    /**
     * Llama a FastAPI para predecir el estado y prioridad de un trámite
     * usando los modelos entrenados desde la Bitácora.
     *
     * @param tramiteId      ID del trámite a predecir
     * @param ultimaAccion   Última acción registrada en la Bitácora
     * @param tiempoEnNodo   Tiempo actual en el nodo (horas)
     * @param semaforizacion Color del semáforo actual
     * @param cantidadPasos  Cantidad de transiciones realizadas
     * @param cantidadCampos Cantidad de campos en el formulario actual
     * @return Predicción con estado, prioridad, confianza y recomendación
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> predecirPrioridad(String tramiteId, String ultimaAccion,
                                                  double tiempoEnNodo, String semaforizacion,
                                                  int cantidadPasos, int cantidadCampos) {
        String url = fastapiUrl + "/ia/predecir";

        Map<String, Object> body = new HashMap<>();
        body.put("tramiteId", tramiteId);
        body.put("ultimaAccion", ultimaAccion);
        body.put("tiempoEnNodo", tiempoEnNodo);
        body.put("semaforizacion", semaforizacion);
        body.put("cantidadPasos", cantidadPasos);
        body.put("cantidadCampos", cantidadCampos);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(url, body, Map.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                System.out.println("✅ [ML] Predicción generada para trámite: " + tramiteId);
                return response.getBody();
            }
        } catch (Exception e) {
            System.out.println("⚠️ [ML] Error al predecir: " + e.getMessage());
        }

        return Map.of(
                "status", "error",
                "mensaje", "No se pudo generar la predicción. El modelo puede no estar entrenado."
        );
    }

    // ============================================================
    // MÉTODO 9: OBTENER ESTADO DEL MODELO ML
    // ============================================================
    /**
     * Consulta el estado actual de los modelos de ML en FastAPI.
     *
     * @return Estado de los modelos, último entrenamiento, accuracy, etc.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> obtenerEstadoModelo() {
        String url = fastapiUrl + "/ia/estado-modelo";

        try {
            ResponseEntity<Map> response = restTemplate.getForEntity(url, Map.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                return response.getBody();
            }
        } catch (Exception e) {
            System.out.println("⚠️ [ML] Error consultando estado del modelo: " + e.getMessage());
        }

        return Map.of(
                "mongodbConectado", false,
                "modeloEstadoCargado", false,
                "modeloPrioridadCargado", false,
                "mensaje", "Servicio de ML no disponible"
        );
    }

    // ============================================================
    // MÉTODO: EDITAR DIAGRAMA CON IA
    // ============================================================
    @SuppressWarnings("unchecked")
    public Map<String, Object> editarDiagrama(Map<String, Object> requestBody) {
        String url = fastapiUrl + "/ia/editar-diagrama";
        try {
            ResponseEntity<Map<String, Object>> response = restTemplate.postForEntity(url, requestBody, (Class<Map<String, Object>>) (Class<?>) Map.class);
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                System.out.println("✅ [IA] Diagrama editado exitosamente desde FastAPI");
                return response.getBody();
            }
        } catch (Exception e) {
            System.out.println("⚠️ [IA-EDITAR] Error conectando con FastAPI: " + e.getMessage());
        }
        Map<String, Object> fallback = new HashMap<>();
        fallback.put("error", "No se pudo editar el diagrama. Verifica que FastAPI esté activo.");
        fallback.put("nodos", java.util.List.of());
        fallback.put("enlaces", java.util.List.of());
        return fallback;
    }
}