package com.nexusflow.nexusflowbackend.model;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
@Document(collection = "Tramite")
public class Tramite {
    @Id
    private String id;
    private String cliente_id; // El dueño/creador
    private String politica_id;
    private String nodo_actual_id;
    private String formulario_actual_id;
    private String estado; // "pendiente", "aprobado", etc.
    private String semaforizacion; // "Verde", "Amarillo", "Rojo"
    private String prioridad;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime fecha_inicio;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime fecha_limite;

    private Double tiempo_total;
    private Map<String, Object> datos_formulario; // Respuestas actuales
    private List<Map<String, Object>> historial; // Bitácora específica del trámite

    // CU-12: Nombre de la política para mostrar en listados
    private String nombre_tramite;

    // CU-12: Respuestas organizadas por paso (pasoId -> {campoId -> valor})
    private Map<String, Map<String, Object>> respuestas_por_nodo = new HashMap<>();

    // CU-12: Timestamps adicionales
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime fecha_ultima_actualizacion;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime fecha_fin;

    // CU-12: Etiquetas de los campos por nodo (campoId → titulo del campo)
    // Permite mostrar nombres legibles en el detalle/documento del trámite
    private Map<String, Map<String, String>> labels_por_nodo = new HashMap<>();

    // Colaboradores invitados al trámite
    private List<Map<String, String>> colaboradores = new ArrayList<>();

    // Evidencias adjuntas
    private List<Map<String, Object>> evidencias = new ArrayList<>();

    // Campos enriquecidos para CU-13 (no persistentes)
    @Transient
    private String empresa_id; // Viene de la Politica, para filtrar documentos S3

    @Transient
    private String cliente_nombre;

    @Transient
    private String cliente_email;

    @Transient
    private String politica_nombre;

    @Transient
    private String nodo_actual_nombre;

    @Transient
    private Long tiempo_restante_horas;

    @Transient
    private String funcionario_asignado_nombre;

    // ============================================================
    // NUEVO CAMPO: Funcionario responsable actual del trámite
    // ============================================================
    /**
     * ID del funcionario que tiene actualmente la responsabilidad de este trámite.
     * Este campo es CLAVE para la reasignación automática de tareas.
     * Si está vacío, se usa el nodo_actual_id para determinar el responsable.
     */
    private String funcionario_asignado_id;
}