package com.nexusflow.nexusflowbackend.model;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@Document(collection = "Politica")
public class Politica {
    @Id
    private String id;
    private String nombre;
    private String tipo_flujo;
    private Integer duracion_estandar_dias;
    private Boolean esta_activa;
    private LocalDateTime fecha_activacion;
    private Map<String, Object> esquema_workflow; // El grafo del proceso
    private String empresa_id;
    private List<String> formularios_ids; // Lista de Formulario_Nodo vinculados
}