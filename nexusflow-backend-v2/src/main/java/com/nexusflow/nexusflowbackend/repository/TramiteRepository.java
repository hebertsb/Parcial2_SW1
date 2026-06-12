package com.nexusflow.nexusflowbackend.repository;

import com.nexusflow.nexusflowbackend.model.Tramite;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TramiteRepository extends MongoRepository<Tramite, String> {
}