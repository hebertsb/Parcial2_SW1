package com.nexusflow.nexusflowbackend.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.util.Map; // <--- VERIFICA ESTO
import java.util.HashMap;

@Data
@Document(collection = "Rol")
public class Rol {
    @Id
    private String id;
    private String nombre_rol;
    private Boolean es_nucleo;
    private String empresa_id;

    // Inicializarlo evita errores de puntero nulo
    private Map<String, Boolean> permisos = new HashMap<>();
}