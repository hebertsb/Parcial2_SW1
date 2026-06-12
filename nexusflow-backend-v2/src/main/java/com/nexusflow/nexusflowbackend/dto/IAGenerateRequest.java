package com.nexusflow.nexusflowbackend.dto;

import lombok.Data;

@Data
public class IAGenerateRequest {
    private String descripcion;
    private String empresaId;
    private String politicaId;
}