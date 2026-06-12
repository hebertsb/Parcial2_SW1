package com.nexusflow.nexusflowbackend.websocket.dto;

public record EstadoTramiteMessage(
    String tramiteId,
    String pasoActualId,
    String estadoNuevo,
    String usuarioId
) {}
