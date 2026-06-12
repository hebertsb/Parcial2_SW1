package com.nexusflow.nexusflowbackend.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;

@Data
@Document(collection = "Empresa")
public class Empresa {
    @Id
    private String id;
    private String nombre_legal;
    private String nit;
    private String telefono;
    private String direccion;
    private String estado; // Ejemplo: "ACTIVO", "SUSPENDIDO"
    private String plan_suscripcion; // Ejemplo: "PREMIUM", "BASIC"
    private LocalDateTime fecha_registro;

    public Empresa() {
        this.fecha_registro = LocalDateTime.now();
    }
}