package com.nexusflow.nexusflowbackend.websocket;

import com.nexusflow.nexusflowbackend.websocket.dto.*;
import com.nexusflow.nexusflowbackend.websocket.service.FormularioRealtimeService;
import com.nexusflow.nexusflowbackend.websocket.service.WorkflowRealtimeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Slf4j
@Controller
@RequiredArgsConstructor
public class WorkflowWebSocketController {

    private final SimpMessagingTemplate mensajeria;
    
    // Inyectamos los servicios delegados manteniendo Alto Nivel de Cohesión y Bajo Acoplamiento
    private final FormularioRealtimeService formularioRealtimeService;
    private final WorkflowRealtimeService workflowRealtimeService;

    // -------------------------------------------------------------
    // CU-09 / CU-10: editor de flujos colaborativo
    // -------------------------------------------------------------

    @MessageMapping("/editor/cambio")
    public void cambioEditor(@Payload EditorCambioDto dto) {
        // Enviar evento en tiempo real a todos los suscriptores
        mensajeria.convertAndSend(
            "/topic/editor/" + dto.politicaId() + "/cambios",
            dto
        );
        
        // Delegar la persistencia de forma asíncrona o bloqueante al servicio
        // Esto mantiene el controlador enfocado únicamente en la mensajería STOMP.
        try {
            workflowRealtimeService.procesarCambioEditor(dto);
        } catch (Exception e) {
            log.error("Error al persistir el cambio en el editor: {}", e.getMessage());
        }
    }

    @MessageMapping("/editor/cursor")
    public void cursorEditor(@Payload CursorEditorDto dto) {
        mensajeria.convertAndSend(
            "/topic/editor/" + dto.politicaId() + "/cursores",
            dto
        );
    }

    // -------------------------------------------------------------
    // CU-11: editor de formularios colaborativo (campo a campo)
    // -------------------------------------------------------------

    @MessageMapping("/formulario/campo")
    public void guardarCampo(@Payload CampoFormularioMessage mensaje) {
        mensajeria.convertAndSend(
            "/topic/formulario/" + mensaje.formularioId() + "/campos",
            mensaje
        );
        
        // Delegar persistencia al servicio de formularios
        try {
            formularioRealtimeService.procesarCampo(mensaje);
        } catch (Exception e) {
            log.error("Error al persistir el campo del formulario: {}", e.getMessage());
        }
    }

    @MessageMapping("/editor/cursor-formulario")
    public void cursorFormulario(@Payload CursorFormularioDto dto) {
        mensajeria.convertAndSend(
            "/topic/editor/" + dto.formularioId() + "/cursores-form",
            dto
        );
    }

    // -------------------------------------------------------------
    // CU-14: ejecución de trámite en tiempo real
    // -------------------------------------------------------------

    @MessageMapping("/tramite/estado")
    @SendTo("/topic/tramite/{tramiteId}/estado")
    public EstadoTramiteMessage estadoTramite(@Payload EstadoTramiteMessage mensaje) {
        // workflowService.aplicarEstado(mensaje);
        return mensaje;
    }
}

