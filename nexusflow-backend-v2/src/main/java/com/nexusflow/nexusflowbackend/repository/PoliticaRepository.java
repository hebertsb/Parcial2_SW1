package com.nexusflow.nexusflowbackend.repository;

import com.nexusflow.nexusflowbackend.model.Politica;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PoliticaRepository extends MongoRepository<Politica, String> {
}