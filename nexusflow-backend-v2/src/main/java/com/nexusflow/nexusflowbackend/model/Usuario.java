package com.nexusflow.nexusflowbackend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.Map;

@Data
// REVISA ESTO: Debe tener la 'U' mayúscula igual que en tu Compass
@Document(collection = "Usuario")
public class Usuario {
    @Id
    private String id;
    private String nombre_completo;
    private String correo_electronico;
    // WRITE_ONLY: se recibe del body en POST/PUT pero nunca se serializa en respuestas GET
    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.WRITE_ONLY)
    private String clave_hash;
    private String telefono;    // <--- Agregá esto
    private String sexo;        // <--- Agregá esto
    private boolean esta_activo; // <--- Agregá esto
    private String empresa_id;  // <--- Agregá esto para la vinculación
    private String rol_id;     // Relación con Rol
    private String unidad_id;  // Relación con Unidad_Organizacional
    private Map<String, Object> rol_detalle; // Campo JSON para datos rápidos
    private String token_recuperacion;
    private LocalDateTime token_expiracion;
}