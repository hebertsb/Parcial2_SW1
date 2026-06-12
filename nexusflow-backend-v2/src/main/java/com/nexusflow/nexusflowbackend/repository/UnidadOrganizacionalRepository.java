package com.nexusflow.nexusflowbackend.repository;

import com.nexusflow.nexusflowbackend.model.Unidad_Organizacional;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query; // Importante
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface UnidadOrganizacionalRepository extends MongoRepository<Unidad_Organizacional, String> {

    // Usamos @Query para decirle a MongoDB exactamente qué campo buscar
    @Query("{ 'empresa_id' : ?0 }")
    List<Unidad_Organizacional> findByEmpresa_id(String empresa_id);
}