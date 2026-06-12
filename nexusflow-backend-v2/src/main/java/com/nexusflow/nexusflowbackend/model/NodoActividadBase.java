package com.nexusflow.nexusflowbackend.model;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import lombok.Data;

@Data
/** * Esta es la "Capa de Transformación".
 * Le dice a Java: "Si en el JSON ves que dice 'tipo: TASK', conviértelo en un TaskNode".
 */
@JsonTypeInfo(
        use = JsonTypeInfo.Id.NAME,
        include = JsonTypeInfo.As.PROPERTY,
        property = "tipo", // Este es el campo clave que vendrá desde JointJS
        defaultImpl = Formulario_Nodo.class
)
@JsonSubTypes({
        @JsonSubTypes.Type(value = TaskNode.class, name = "TASK"),
        @JsonSubTypes.Type(value = GatewayNode.class, name = "GATEWAY"),
        @JsonSubTypes.Type(value = Formulario_Nodo.class, name = "FORM"),
        @JsonSubTypes.Type(value = Formulario_Nodo.class, name = "NODO_INICIO"),
        @JsonSubTypes.Type(value = Formulario_Nodo.class, name = "NODO_FIN"),
        @JsonSubTypes.Type(value = Formulario_Nodo.class, name = "SWIMLANE")
})
public abstract class NodoActividadBase {
    private String id_visual; // El ID que le da el Architect (ej: "j_1")
    private String nombre;
    private double x; // Posición horizontal en la pizarra
    private double y; // Posición vertical en la pizarra
}