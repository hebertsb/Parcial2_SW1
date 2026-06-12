package com.nexusflow.nexusflowbackend.websocket.dto;

public record CursorEditorDto(
    String politicaId,
    String usuarioId,
    String usuarioNombre,
    String color,
    double x,
    double y
) {}
