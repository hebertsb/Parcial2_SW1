package com.nexusflow.nexusflowbackend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexusflow.nexusflowbackend.model.PushSubscription;
import com.nexusflow.nexusflowbackend.model.VapidKeys;
import com.nexusflow.nexusflowbackend.repository.PushSubscriptionRepository;
import com.nexusflow.nexusflowbackend.repository.VapidKeysRepository;
import jakarta.annotation.PostConstruct;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import org.bouncycastle.jce.ECNamedCurveTable;
import org.bouncycastle.jce.interfaces.ECPrivateKey;
import org.bouncycastle.jce.interfaces.ECPublicKey;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.jce.spec.ECNamedCurveParameterSpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Security;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@Service
public class WebPushService {

    private static final Logger log = LoggerFactory.getLogger(WebPushService.class);

    @Autowired
    private PushSubscriptionRepository pushSubscriptionRepository;

    @Autowired
    private VapidKeysRepository vapidKeysRepository;

    private PushService pushService;
    private String vapidPublicKeyB64;

    @PostConstruct
    public void init() {
        try {
            if (Security.getProvider("BC") == null) {
                Security.addProvider(new BouncyCastleProvider());
            }

            // Reusar claves persistidas en Mongo: si se regeneraran en cada
            // reinicio, todas las suscripciones de los navegadores morirían.
            VapidKeys stored = vapidKeysRepository.findById("vapid").orElse(null);
            String vapidPrivateKeyB64;

            if (stored != null && stored.getPublicKeyB64() != null && stored.getPrivateKeyB64() != null) {
                vapidPublicKeyB64 = stored.getPublicKeyB64();
                vapidPrivateKeyB64 = stored.getPrivateKeyB64();
                log.info("[WebPush] VAPID keys loaded from Mongo");
            } else {
                // Generate P-256 key pair for VAPID
                ECNamedCurveParameterSpec params = ECNamedCurveTable.getParameterSpec("prime256v1");
                KeyPairGenerator kpg = KeyPairGenerator.getInstance("EC", "BC");
                kpg.initialize(params);
                KeyPair keyPair = kpg.generateKeyPair();

                // Public key: uncompressed EC point (65 bytes)
                ECPublicKey pubKey = (ECPublicKey) keyPair.getPublic();
                byte[] pubBytes = pubKey.getQ().getEncoded(false);
                vapidPublicKeyB64 = Base64.getUrlEncoder().withoutPadding().encodeToString(pubBytes);

                // Private key: raw scalar (32 bytes)
                ECPrivateKey privKey = (ECPrivateKey) keyPair.getPrivate();
                byte[] privBytes = privKey.getD().toByteArray();
                if (privBytes.length == 33 && privBytes[0] == 0) {
                    privBytes = Arrays.copyOfRange(privBytes, 1, 33);
                }
                vapidPrivateKeyB64 = Base64.getUrlEncoder().withoutPadding().encodeToString(privBytes);

                VapidKeys keys = new VapidKeys();
                keys.setPublicKeyB64(vapidPublicKeyB64);
                keys.setPrivateKeyB64(vapidPrivateKeyB64);
                vapidKeysRepository.save(keys);
                log.info("[WebPush] New VAPID keys generated and persisted");
            }

            pushService = new PushService(vapidPublicKeyB64, vapidPrivateKeyB64, "mailto:nexusflow@demo.com");
            log.info("[WebPush] VAPID initialized. Public key prefix: {}", vapidPublicKeyB64.substring(0, 20));
        } catch (Exception e) {
            log.error("[WebPush] Failed to initialize VAPID keys", e);
        }
    }

    public String getVapidPublicKey() {
        return vapidPublicKeyB64;
    }

    public void saveSubscription(PushSubscription sub) {
        // Borrar solo la entrada del mismo endpoint+docId: la suscripción global
        // (docId="") y las de documentos específicos deben coexistir.
        if (sub.getDocId() == null) sub.setDocId("");
        pushSubscriptionRepository.deleteByEndpointAndDocId(sub.getEndpoint(), sub.getDocId());
        pushSubscriptionRepository.save(sub);
        log.info("[WebPush] Subscription saved for docId={} nombre={}", sub.getDocId(), sub.getNombre());
    }

    public void sendToDoc(String docId, String senderEndpoint, String titulo, String mensaje, String url) {
        sendToSubs(pushSubscriptionRepository.findByDocId(docId), senderEndpoint, titulo, mensaje, url);
    }

    /** Push dirigido a todas las suscripciones de un usuario (sin importar el documento) */
    public void sendToUser(String usuarioId, String titulo, String mensaje, String url) {
        sendToSubs(pushSubscriptionRepository.findByUsuarioId(usuarioId), "", titulo, mensaje, url);
    }

    private void sendToSubs(List<PushSubscription> subs, String senderEndpoint, String titulo, String mensaje, String url) {
        if (url == null || url.isBlank()) url = "/";
        if (pushService == null) {
            log.warn("[WebPush] pushService not initialized, skipping");
            return;
        }
        ObjectMapper mapper = new ObjectMapper();

        for (PushSubscription sub : subs) {
            if (sub.getEndpoint().equals(senderEndpoint)) continue;
            try {
                String payload = mapper.writeValueAsString(Map.of(
                        "title", titulo,
                        "body", mensaje,
                        "icon", "/notif-icon.png",
                        "url", url
                ));
                Notification notification = new Notification(
                        sub.getEndpoint(),
                        sub.getP256dh(),
                        sub.getAuth(),
                        payload.getBytes()
                );
                pushService.send(notification);
                log.info("[WebPush] Push sent to {}", sub.getNombre());
            } catch (Exception e) {
                log.warn("[WebPush] Failed to send push to {}: {}", sub.getNombre(), e.getMessage());
                pushSubscriptionRepository.deleteByEndpoint(sub.getEndpoint());
            }
        }
    }
}
