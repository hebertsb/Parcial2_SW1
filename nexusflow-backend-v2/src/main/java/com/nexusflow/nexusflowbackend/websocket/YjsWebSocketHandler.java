package com.nexusflow.nexusflowbackend.websocket;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.AbstractWebSocketHandler;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

/**
 * Handler WebSocket para sincronización Y.js (CRDT colaborativo).
 * Protocolo: y-websocket (binario) — broadcast a todos en mismo docId.
 * Un docId = un documento = una sala de colaboración.
 */
@Component
public class YjsWebSocketHandler extends AbstractWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(YjsWebSocketHandler.class);

    // docId → Set de sesiones conectadas
    private final Map<String, Set<WebSocketSession>> salas = new ConcurrentHashMap<>();
    // sessionId → docId
    private final Map<String, String> sesionADoc = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String docId = extraerDocId(session);
        if (docId == null) {
            log.warn("Conexión Y.js sin docId, cerrando");
            session.close();
            return;
        }

        salas.computeIfAbsent(docId, k -> new CopyOnWriteArraySet<>()).add(session);
        sesionADoc.put(session.getId(), docId);

        int usuarios = salas.get(docId).size();
        log.info("Y.js: sesión {} conectada a doc={} ({} usuario/s)", session.getId(), docId, usuarios);
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) throws Exception {
        String docId = sesionADoc.get(session.getId());
        if (docId == null) return;

        Set<WebSocketSession> sala = salas.get(docId);
        if (sala == null) return;

        // Broadcast binario a todos excepto el emisor
        byte[] payload = message.getPayload().array();
        for (WebSocketSession peer : sala) {
            if (peer.isOpen() && !peer.getId().equals(session.getId())) {
                try {
                    peer.sendMessage(new BinaryMessage(payload));
                } catch (IOException e) {
                    log.warn("Error enviando a peer {}: {}", peer.getId(), e.getMessage());
                }
            }
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        // Y.js puede enviar texto para awareness
        String docId = sesionADoc.get(session.getId());
        if (docId == null) return;

        Set<WebSocketSession> sala = salas.get(docId);
        if (sala == null) return;

        for (WebSocketSession peer : sala) {
            if (peer.isOpen() && !peer.getId().equals(session.getId())) {
                try {
                    peer.sendMessage(message);
                } catch (IOException e) {
                    log.warn("Error enviando texto a peer: {}", e.getMessage());
                }
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String docId = sesionADoc.remove(session.getId());
        if (docId == null) return;

        Set<WebSocketSession> sala = salas.get(docId);
        if (sala != null) {
            sala.remove(session);
            if (sala.isEmpty()) {
                salas.remove(docId);
                log.info("Y.js: sala {} vacía, eliminada", docId);
            }
        }
        log.info("Y.js: sesión {} desconectada de doc={}", session.getId(), docId);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        log.error("Y.js transport error sesión {}: {}", session.getId(), exception.getMessage());
        afterConnectionClosed(session, CloseStatus.SERVER_ERROR);
    }

    private String extraerDocId(WebSocketSession session) {
        // y-websocket envía docId como último segmento de la URL
        // ws://host/ws-yjs/nexusflow-doc-xxx
        String path = session.getUri() != null ? session.getUri().getPath() : "";
        String[] parts = path.split("/");
        if (parts.length > 0) {
            String last = parts[parts.length - 1];
            if (!last.isEmpty()) return last;
        }

        // Fallback: query param ?docId=xxx
        String query = session.getUri() != null ? session.getUri().getQuery() : "";
        if (query != null && query.contains("docId=")) {
            for (String param : query.split("&")) {
                if (param.startsWith("docId=")) {
                    return param.substring(6);
                }
            }
        }
        return null;
    }
}
