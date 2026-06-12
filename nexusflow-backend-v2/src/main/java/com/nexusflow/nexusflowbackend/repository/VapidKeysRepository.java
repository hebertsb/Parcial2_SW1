package com.nexusflow.nexusflowbackend.repository;

import com.nexusflow.nexusflowbackend.model.VapidKeys;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface VapidKeysRepository extends MongoRepository<VapidKeys, String> {
}
