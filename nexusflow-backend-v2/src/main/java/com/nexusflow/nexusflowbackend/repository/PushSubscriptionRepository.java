package com.nexusflow.nexusflowbackend.repository;

import com.nexusflow.nexusflowbackend.model.PushSubscription;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface PushSubscriptionRepository extends MongoRepository<PushSubscription, String> {
    List<PushSubscription> findByDocId(String docId);
    List<PushSubscription> findByUsuarioId(String usuarioId);
    void deleteByEndpoint(String endpoint);
    void deleteByEndpointAndDocId(String endpoint, String docId);
}
