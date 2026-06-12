package com.nexusflow.nexusflowbackend.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Par de claves VAPID persistido en Mongo.
 * Si se regenerara en cada reinicio del backend, todas las suscripciones
 * push existentes en los navegadores quedarían inválidas.
 */
@Data
@Document(collection = "VapidKeys")
public class VapidKeys {
    @Id
    private String id = "vapid";
    private String publicKeyB64;
    private String privateKeyB64;
}
