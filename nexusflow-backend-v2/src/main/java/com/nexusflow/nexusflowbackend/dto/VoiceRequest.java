package com.nexusflow.nexusflowbackend.dto;

import lombok.Data;

@Data
public class VoiceRequest {
    private String tramiteId;
    private String campoId;
    private String audioBase64;
    private String formato;
}