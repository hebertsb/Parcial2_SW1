package com.nexusflow.nexusflowbackend.controller;

import com.nexusflow.nexusflowbackend.service.WorkflowService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/workflow")
@CrossOrigin(origins = "*") // Para que tu Angular no tenga problemas de CORS
public class WorkflowController {

    @Autowired
    private WorkflowService workflowService;

    /**
     * CU-09: Exportar el modelo lógico en formato UML 2.5 (JSON estructurado).
     * Solo accesible para Diseñadores y Admins.
     */
    @GetMapping("/exportar/{politicaId}")
    @PreAuthorize("hasAnyRole('DISEÑADOR', 'ADMIN', 'SUPER')")
    public ResponseEntity<?> exportarModeloUML(@PathVariable String politicaId) {
        try {
            Map<String, Object> modelo = workflowService.exportarModeloLogico(politicaId);

            // Si no hay calles (nodos), avisamos que no hay contenido
            if (modelo.get("calles") == null || ((Map<?, ?>) modelo.get("calles")).isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "No se encontraron nodos para esta política"));
            }

            return ResponseEntity.ok(modelo);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Error al exportar el modelo: " + e.getMessage()));
        }
    }
}