package com.nexusflow.nexusflowbackend.websocket.dto;

public record CursorFormularioDto(
    String formularioId,
    String usuarioId,
    String usuarioNombre,
    String color,
    String campoId
) {}
