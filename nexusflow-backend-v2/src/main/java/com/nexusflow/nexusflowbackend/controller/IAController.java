package com.nexusflow.nexusflowbackend.controller;

import com.nexusflow.nexusflowbackend.dto.IAGenerateRequest;
import com.nexusflow.nexusflowbackend.model.Politica;
import com.nexusflow.nexusflowbackend.service.IAGenerateDiagramService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/ia")
@CrossOrigin(origins = "*") // Para conexión con Angular/Flutter
public class IAController {

    @Autowired
    private IAGenerateDiagramService iaService;

    @Autowired
    private com.nexusflow.nexusflowbackend.service.PythonAIService pythonAIService;

    /**
     * POST: Generar un diagrama de actividad desde una descripción en lenguaje natural
     * URL: http://localhost:9090/api/ia/generar-diagrama
     * Headers: Authorization: Bearer <token>, Content-Type: application/json
     * Body: {
     *   "descripcion": "Flujo de aprobación de crédito donde cliente solicita, analista evalúa, comité aprueba",
     *   "empresaId": "EMP-001"
     * }
     * Respuesta: JSON con nodos y enlaces del diagrama UML
     */
    @PostMapping("/generar-diagrama")
    public ResponseEntity<?> generarDiagrama(@RequestBody IAGenerateRequest request) {
        Map<String, Object> diagrama = iaService.generarDiagramaDesdeTexto(
                request.getDescripcion(),
                request.getEmpresaId()
        );
        return ResponseEntity.ok(diagrama);
    }

    /**
     * POST: Generar diagrama con IA Y guardarlo automáticamente como nueva política
     * URL: http://localhost:9090/api/ia/generar-y-guardar
     * Headers: Authorization: Bearer <token>, Content-Type: application/json
     * Body: {
     *   "descripcion": "Flujo de vacaciones donde empleado solicita, jefe aprueba, RRHH valida",
     *   "empresaId": "EMP-001"
     * }
     * Respuesta: La política creada con su ID y esquema
     */
    @PostMapping("/generar-y-guardar")
    public ResponseEntity<?> generarYGuardar(@RequestBody IAGenerateRequest request,
                                             Authentication auth) {
        String usuarioId = auth.getName();

        // Si viene politicaId: actualizar política existente con el diagrama generado
        if (request.getPoliticaId() != null && !request.getPoliticaId().isBlank()) {
            Politica actualizada = iaService.generarYActualizarPolitica(
                    request.getPoliticaId(),
                    request.getDescripcion(),
                    usuarioId
            );
            return ResponseEntity.ok(actualizada);
        }

        // Sin politicaId: crear nueva política (comportamiento anterior)
        Politica nuevaPolitica = iaService.generarYGuardarPolitica(
                request.getDescripcion(),
                request.getEmpresaId(),
                usuarioId
        );
        return ResponseEntity.ok(nuevaPolitica);
    }

    /**
     * POST: Transcribir audio a texto usando Whisper a través de FastAPI
     * URL: http://localhost:9090/api/ia/transcribir-voz
     */
    /**
     * POST: Editar diagrama existente con instrucción en lenguaje natural
     * URL: http://localhost:9090/api/ia/editar-diagrama/{politicaId}
     * Body: { "instruccion": "Agrega un carril de Legal..." }
     */
    @PostMapping("/editar-diagrama/{politicaId}")
    public ResponseEntity<?> editarDiagrama(@PathVariable String politicaId,
                                            @RequestBody Map<String, String> request,
                                            Authentication auth) {
        try {
            String instruccion = request.get("instruccion");
            if (instruccion == null || instruccion.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Falta el campo 'instruccion'"));
            }
            String usuarioId = auth.getName();
            Politica actualizada = iaService.editarDiagramaEnPolitica(politicaId, instruccion, usuarioId);
            return ResponseEntity.ok(actualizada);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Error al editar diagrama: " + e.getMessage()));
        }
    }

    @PostMapping("/transcribir-voz")
    public ResponseEntity<?> transcribirVoz(@RequestBody Map<String, String> request) {
        try {
            String audioBase64 = request.get("audio");
            if (audioBase64 == null || audioBase64.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Falta el campo 'audio' en Base64"));
            }
            
            // Limpiar la cabecera si viene como "data:audio/webm;base64,..."
            if (audioBase64.contains(",")) {
                audioBase64 = audioBase64.substring(audioBase64.indexOf(",") + 1);
            }

            // Llamar a PythonAIService
            Map<String, Object> respuesta = pythonAIService.transcribirAudio(audioBase64, "webm", null, null);
            return ResponseEntity.ok(respuesta);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("error", "Error interno al transcribir el audio: " + e.getMessage()));
        }
    }
}