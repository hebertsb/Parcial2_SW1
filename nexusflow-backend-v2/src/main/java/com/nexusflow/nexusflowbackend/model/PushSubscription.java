package com.nexusflow.nexusflowbackend.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;

@Data
@Document(collection = "PushSubscription")
public class PushSubscription {
    @Id
    private String id;
    private String endpoint;
    private String p256dh;
    private String auth;
    private String docId;
    private String nombre;
    /** ID del usuario dueño de la suscripción — permite push dirigido sin importar el documento */
    private String usuarioId;
    private LocalDateTime registeredAt = LocalDateTime.now();
}
