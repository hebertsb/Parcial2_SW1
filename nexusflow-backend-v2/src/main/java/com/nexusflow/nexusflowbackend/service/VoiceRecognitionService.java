package com.nexusflow.nexusflowbackend.service;

import com.nexusflow.nexusflowbackend.model.Tramite;
import com.nexusflow.nexusflowbackend.repository.TramiteRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Servicio de reconocimiento de voz para rellenado automático de formularios (CU-18).
 *
 * Flujo: Flutter/Angular graba audio → Base64 → Spring Boot → FastAPI → Whisper API → texto
 */
@Service
public class VoiceRecognitionService {

    @Autowired
    private TramiteRepository tramiteRepository;

    @Autowired
    private PythonAIService pythonAIService;

    /**
     * Transcribe audio a texto llamando al microservicio FastAPI (Whisper API).
     *
     * @param audioBase64 Audio codificado en Base64
     * @param formato     Formato del audio (wav, mp3, webm, ogg)
     * @return Texto transcrito
     */
    public String transcribirAudio(String audioBase64, String formato) {
        // Llamar al servicio FastAPI de IA para transcribir
        Map<String, Object> resultado = pythonAIService.transcribirAudio(
                audioBase64, formato, "", ""
        );
        return (String) resultado.getOrDefault("texto", "No se pudo transcribir el audio.");
    }

    /**
     * Transcribe audio con IA Y actualiza el campo del trámite en MongoDB.
     *
     * @param tramiteId   ID del trámite a actualizar
     * @param campoId     Campo del formulario a rellenar
     * @param audioBase64 Audio codificado en Base64
     * @param formato     Formato del audio
     * @return Mapa con campoId, texto transcrito y tramiteId
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> procesarVozYActualizarTramite(String tramiteId, String campoId,
                                                              String audioBase64, String formato) {
        // 1. Transcribir audio con FastAPI (Whisper API)
        Map<String, Object> transcripcion = pythonAIService.transcribirAudio(
                audioBase64, formato, tramiteId, campoId
        );

        String texto = (String) transcripcion.getOrDefault("texto", "");
        Map<String, Object> entidades = (Map<String, Object>) transcripcion.get("entidades");

        // 2. Actualizar el trámite en MongoDB
        Tramite tramite = tramiteRepository.findById(tramiteId).orElseThrow(
                () -> new RuntimeException("Trámite no encontrado: " + tramiteId)
        );

        Map<String, Object> datos = tramite.getDatos_formulario();
        if (datos == null) datos = new HashMap<>();
        datos.put(campoId, texto);

        // Si la IA extrajo entidades adicionales, guardarlas también
        if (entidades != null && !entidades.isEmpty()) {
            for (Map.Entry<String, Object> entry : entidades.entrySet()) {
                datos.putIfAbsent(entry.getKey(), entry.getValue());
            }
        }

        tramite.setDatos_formulario(datos);
        tramiteRepository.save(tramite);

        System.out.println("✅ [VOZ] Campo '" + campoId + "' actualizado con: " + texto);

        // 3. Devolver resultado
        Map<String, Object> resultado = new HashMap<>();
        resultado.put("campoId", campoId);
        resultado.put("texto", texto);
        resultado.put("tramiteId", tramiteId);
        if (entidades != null) {
            resultado.put("entidades", entidades);
        }
        return resultado;
    }
}