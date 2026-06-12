package com.nexusflow.nexusflowbackend.repository;

import com.nexusflow.nexusflowbackend.model.Rol;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface RolRepository extends MongoRepository<Rol, String> {

    // Usamos @Query para buscar directamente por el nombre del campo en MongoDB
    @Query("{ 'empresa_id' : ?0 }")
    List<Rol> buscarPorEmpresaId(String empresa_id);
}