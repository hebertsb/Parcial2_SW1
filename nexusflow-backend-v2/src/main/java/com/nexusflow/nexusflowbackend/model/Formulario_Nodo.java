package com.nexusflow.nexusflowbackend.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;
import java.util.Map;

@Data
@Document(collection = "Formulario_Nodo")
@JsonTypeInfo(
        use = JsonTypeInfo.Id.NAME,
        include = JsonTypeInfo.As.PROPERTY,
        property = "tipo",
        defaultImpl = Formulario_Nodo.class
)
@JsonSubTypes({
        @JsonSubTypes.Type(value = TaskNode.class, name = "TASK"),
        @JsonSubTypes.Type(value = GatewayNode.class, name = "GATEWAY"),
        @JsonSubTypes.Type(value = Formulario_Nodo.class, name = "NODO_INICIO"),
        @JsonSubTypes.Type(value = Formulario_Nodo.class, name = "NODO_FIN"),
        @JsonSubTypes.Type(value = Formulario_Nodo.class, name = "FORM")
})
public class Formulario_Nodo extends NodoActividadBase {
    @Id
    private String id;
    private String id_nodo;
    @JsonProperty("nombre")
    private String nombre_nodo;
    private String tipo_nodo;
    private String unidad_id;
    private Boolean activo;
    private Integer posicion_x;
    private Integer posicion_y;
    @JsonProperty("politicaId")
    private String politica_id;
    private List<String> permisos;
    @JsonProperty("campos")
    private List<Map<String, Object>> esquema_campos;
}