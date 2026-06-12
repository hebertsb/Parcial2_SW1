package com.nexusflow.nexusflowbackend.websocket;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

/**
 * Distribuye cambios de documentos colaborativos a todos los usuarios conectados.
 * Cliente envía a /app/doc/{docId}/update → broadcast a /topic/doc/{docId}
 */
@Controller
public class DocColabController {

    @Autowired
    private SimpMessagingTemplate messaging;

    @MessageMapping("/doc/{docId}/update")
    public void recibirCambio(@DestinationVariable String docId, @Payload String body) {
        messaging.convertAndSend("/topic/doc/" + docId, body);
    }

    @MessageMapping("/doc/{docId}/presencia")
    public void recibirPresencia(@DestinationVariable String docId, @Payload String body) {
        messaging.convertAndSend("/topic/doc/" + docId + "/presencia", body);
    }

    @MessageMapping("/doc/{docId}/cursor")
    public void recibirCursor(@DestinationVariable String docId, @Payload String body) {
        messaging.convertAndSend("/topic/doc/" + docId + "/cursor", body);
    }
}
