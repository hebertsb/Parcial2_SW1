package com.nexusflow.nexusflowbackend.controller;

import com.nexusflow.nexusflowbackend.dto.VoiceRequest;
import com.nexusflow.nexusflowbackend.service.VoiceRecognitionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/voz")
@CrossOrigin(origins = "*") // Para conexión con Flutter (grabación de voz)
public class VoiceController {

    @Autowired
    private VoiceRecognitionService voiceService;

    /**
     * POST: Transcribir audio a texto usando IA
     * URL: http://localhost:9090/api/voz/transcribir
     * Headers: Authorization: Bearer <token>, Content-Type: application/json
     * Body: {
     *   "audioBase64": "base64_del_audio_grabado",
     *   "formato": "webm",
     *   "tramiteId": "ID_DEL_TRAMITE",
     *   "campoId": "observaciones"
     * }
     * Respuesta: {"texto": "El cliente cumple con todos los requisitos..."}
     */
    @PostMapping("/transcribir")
    public ResponseEntity<?> transcribir(@RequestBody VoiceRequest request) {
        String texto = voiceService.transcribirAudio(request.getAudioBase64(), request.getFormato());
        return ResponseEntity.ok(Map.of("texto", texto));
    }

    /**
     * POST: Transcribir audio Y actualizar automáticamente un campo del formulario
     * URL: http://localhost:9090/api/voz/actualizar-campo
     * Headers: Authorization: Bearer <token>, Content-Type: application/json
     * Body: {
     *   "tramiteId": "67e1bb8c6f5672e9ef911e3e",
     *   "campoId": "dictamen_tecnico",
     *   "audioBase64": "base64_del_audio",
     *   "formato": "webm"
     * }
     * Respuesta: {"campoId": "dictamen_tecnico", "texto": "...", "tramiteId": "..."}
     */
    @PostMapping("/actualizar-campo")
    public ResponseEntity<?> actualizarCampo(@RequestBody VoiceRequest request) {
        Map<String, Object> resultado = voiceService.procesarVozYActualizarTramite(
                request.getTramiteId(),
                request.getCampoId(),
                request.getAudioBase64(),
                request.getFormato()
        );
        return ResponseEntity.ok(resultado);
    }
}