package com.nexusflow.nexusflowbackend.model;

import lombok.Data;
import lombok.EqualsAndHashCode;
import java.util.Map;

@Data
@EqualsAndHashCode(callSuper = true)
public class GatewayNode extends Formulario_Nodo {
    private Map<String, String> reglas_decision;
}