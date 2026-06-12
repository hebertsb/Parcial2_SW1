package com.nexusflow.nexusflowbackend.controller;

import com.nexusflow.nexusflowbackend.service.DashboardService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/dashboard")
@CrossOrigin(origins = "*") // Para conexión con Angular/Flutter
public class DashboardController {

    @Autowired
    private DashboardService dashboardService;

    /**
     * GET: Obtener todas las métricas del dashboard para una empresa
     * URL: http://localhost:9090/api/dashboard/{empresaId}
     * Ejemplo: http://localhost:9090/api/dashboard/EMP-001
     * Headers: Authorization: Bearer <token>
     * Respuesta: {
     *   "totalTramites": 45,
     *   "pendientes": 10,
     *   "enProgreso": 20,
     *   "finalizados": 15,
     *   "porPrioridad": {"Alta": 8, "Media": 25, "Baja": 12},
     *   "porSemaforo": {"Rojo": 5, "Amarillo": 10, "Verde": 30},
     *   "usuariosActivos": 12,
     *   "politicasActivas": 3,
     *   "fechaGeneracion": "2026-04-20T10:30:00"
     * }
     */
    @GetMapping("/{empresaId}")
    public ResponseEntity<?> obtenerDashboard(@PathVariable String empresaId) {
        return ResponseEntity.ok(dashboardService.obtenerDashboard(empresaId));
    }
}