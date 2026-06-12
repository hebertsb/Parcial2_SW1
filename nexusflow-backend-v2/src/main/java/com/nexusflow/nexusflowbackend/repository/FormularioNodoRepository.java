package com.nexusflow.nexusflowbackend.repository;

import com.nexusflow.nexusflowbackend.model.Formulario_Nodo;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface FormularioNodoRepository extends MongoRepository<Formulario_Nodo, String> {

    // Usamos @Query para evitar líos con el guion bajo del nombre
    @Query("{ 'politica_id' : ?0 }")
    List<Formulario_Nodo> buscarPorPolitica(String politicaId);
}