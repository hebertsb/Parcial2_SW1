package com.nexusflow.nexusflowbackend.controller;

import com.nexusflow.nexusflowbackend.service.AnalyticsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/analytics")
@CrossOrigin(origins = "*") // Para conexión con Angular/Flutter
public class AnalyticsController {

    @Autowired
    private AnalyticsService analyticsService;

    /**
     * GET: Detectar cuellos de botella en los procesos de una empresa
     * URL: http://localhost:9090/api/analytics/cuellos-botella/{empresaId}
     * Ejemplo: http://localhost:9090/api/analytics/cuellos-botella/EMP-001
     * Headers: Authorization: Bearer <token>
     * Respuesta: {
     *   "cuellosBotella": [
     *     {"nodoId": "NODO-002", "tiempoPromedioHoras": 72.5, "cantidadTramites": 3}
     *   ],
     *   "totalTramitesActivos": 15
     * }
     */
    @GetMapping("/cuellos-botella/{empresaId}")
    public ResponseEntity<?> detectarCuellosBotella(@PathVariable String empresaId) {
        return ResponseEntity.ok(analyticsService.detectarCuellosBotella(empresaId));
    }

    @GetMapping("/sugerencias/{empresaId}")
    public ResponseEntity<?> obtenerSugerencias(@PathVariable String empresaId) {
        return ResponseEntity.ok(analyticsService.sugerirMejoras(empresaId));
    }

    @GetMapping("/alertas/{empresaId}")
    public ResponseEntity<?> obtenerAlertas(@PathVariable String empresaId) {
        return ResponseEntity.ok(analyticsService.obtenerAlertasActivas(empresaId));
    }

    @PostMapping("/reasignar")
    public ResponseEntity<?> reasignarTareas(@RequestBody Map<String, String> request) {
        analyticsService.reasignarTareasAutomaticamente(
                request.get("nodoId"),
                Long.parseLong(request.get("umbral")),
                request.get("funcionarioId")
        );
        return ResponseEntity.ok(Map.of("mensaje", "Reasignación ejecutada"));
    }

    @PostMapping("/escalar")
    public ResponseEntity<?> escalarVencidos(@RequestBody Map<String, String> request) {
        analyticsService.escalarTramitesVencidos(request.get("adminId"));
        return ResponseEntity.ok(Map.of("mensaje", "Escalamiento ejecutado"));
    }
}