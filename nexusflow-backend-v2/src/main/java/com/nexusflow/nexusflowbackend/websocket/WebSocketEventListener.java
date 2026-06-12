package com.nexusflow.nexusflowbackend.websocket;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

@Slf4j
@Component
public class WebSocketEventListener {

    @EventListener
    public void manejarConexion(SessionConnectedEvent evento) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(evento.getMessage());
        log.debug("Cliente WebSocket conectado: {}", accessor.getSessionId());
    }

    @EventListener
    public void manejarDesconexion(SessionDisconnectEvent evento) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(evento.getMessage());
        log.debug("Cliente WebSocket desconectado: {}", accessor.getSessionId());
    }
}
