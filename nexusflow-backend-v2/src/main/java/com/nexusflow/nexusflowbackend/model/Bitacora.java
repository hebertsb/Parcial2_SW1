package com.nexusflow.nexusflowbackend.model;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@Document(collection = "Bitacora")
public class Bitacora {
    @Id
    private String id;
    private String accion;
    private String estado;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime fecha_hora;
    private String usuario_id;
    private String tramite_id;
    private Map<String, Object> detalle_ia; // Para entrenamiento de vectores
}