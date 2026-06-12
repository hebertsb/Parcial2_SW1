package com.nexusflow.nexusflowbackend.controller;

import com.nexusflow.nexusflowbackend.model.PushSubscription;
import com.nexusflow.nexusflowbackend.service.WebPushService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/push")
@CrossOrigin(origins = "*")
public class WebPushController {

    @Autowired
    private WebPushService webPushService;

    /** Angular fetches this to create the push subscription */
    @GetMapping("/vapid-key")
    public ResponseEntity<Map<String, String>> getVapidKey() {
        return ResponseEntity.ok(Map.of("publicKey", webPushService.getVapidPublicKey()));
    }

    /** Angular registers a push subscription after user grants permission */
    @PostMapping("/subscribe")
    public ResponseEntity<?> subscribe(@RequestBody Map<String, Object> body) {
        PushSubscription sub = new PushSubscription();
        sub.setEndpoint((String) body.get("endpoint"));
        sub.setDocId((String) body.get("docId"));
        sub.setNombre((String) body.get("nombre"));
        sub.setUsuarioId((String) body.get("usuarioId"));

        @SuppressWarnings("unchecked")
        Map<String, String> keys = (Map<String, String>) body.get("keys");
        if (keys != null) {
            sub.setP256dh(keys.get("p256dh"));
            sub.setAuth(keys.get("auth"));
        }
        webPushService.saveSubscription(sub);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    /** Called when a user clicks "Solicitar edición" */
    @PostMapping("/notify")
    public ResponseEntity<?> notify(@RequestBody Map<String, String> body) {
        String docId        = body.get("docId");
        String senderEndpoint = body.getOrDefault("senderEndpoint", "");
        String autor        = body.getOrDefault("autor", "Un colaborador");
        String mensaje      = body.getOrDefault("mensaje", autor + " solicita que revises el documento");
        String url          = body.getOrDefault("url", "/");

        webPushService.sendToDoc(docId, senderEndpoint, "✏️ NexusFlow — Solicitud de edición", mensaje, url);
        return ResponseEntity.ok(Map.of("ok", true));
    }
}
