package com.nexusflow.nexusflowbackend.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

/**
 * DTO para recibir el esquema del workflow desde el frontend (JointJS).
 *
 * Usamos Map<String, Object> en lugar de NodoActividadBase para evitar
 * que Jackson transforme/pierda campos durante la deserialización.
 * Esto garantiza que todos los campos del frontend (id_visual, nombre,
 * posicion_x, posicion_y, tipo, enlaces, etc.) se persistan intactos en MongoDB.
 */
@Data
public class WorkflowDTO {
    private String version;
    private List<Map<String, Object>> pasos;      // Nodos/Pasos del flujo
    private List<Map<String, Object>> relaciones; // Aristas/Relaciones del flujo
    private String tipoFlujo;                     // Tipo de flujo (Decisión, Paralelo, Secuencial)
    private List<Map<String, Object>> formularios; // Formularios asociados al workflow
    private List<Map<String, Object>> carriles;    // Carriles/Swimlanes del flujo
    private Map<String, Object> metadatos;          // Metadatos adicionales del esquema
}