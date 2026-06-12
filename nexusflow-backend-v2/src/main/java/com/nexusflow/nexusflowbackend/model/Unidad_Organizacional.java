package com.nexusflow.nexusflowbackend.model;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Document(collection = "Unidad_Organizacional")
public class Unidad_Organizacional {
    @Id
    private String id;
    private String nombre;
    private String sigla;
    private Boolean esta_activa;
    private String empresa_id;
    private String padre_id; // Para jerarquías (Departamento -> Unidad)
}