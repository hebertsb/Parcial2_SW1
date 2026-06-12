package com.nexusflow.nexusflowbackend.websocket.dto;

public record CampoFormularioMessage(
    String formularioId,
    String campoId,
    String atributo,
    Object valor,
    String usuarioId,
    String usuarioNombre
) {}
