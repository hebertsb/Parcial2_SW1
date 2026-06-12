package com.nexusflow.nexusflowbackend.websocket.dto;

public record EditorCambioDto(
    String politicaId,
    String usuarioId,
    String usuarioNombre,
    String tipo,
    Object payload,
    Long timestamp
) {}
