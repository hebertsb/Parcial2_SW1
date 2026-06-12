package com.nexusflow.nexusflowbackend.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;

@Data
@Document(collection = "Notificacion")
public class Notificacion {
    @Id
    private String id;
    private String usuarioId;
    private String tramiteId;
    private String politicaId;
    private String tipo;
    private String titulo;
    private String mensaje;
    private Boolean leida = false;
    private LocalDateTime fechaCreacion;
    private String icono;
    private String color;
    // Documento asociado (para abrir el editor colaborativo desde la campana)
    private String docKey;
    private String docNombre;
}