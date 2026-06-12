package com.nexusflow.nexusflowbackend.model;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class TaskNode extends Formulario_Nodo {
    private String rol_asignado;
}