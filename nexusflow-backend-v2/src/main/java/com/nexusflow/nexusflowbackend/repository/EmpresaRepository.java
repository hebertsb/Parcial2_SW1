package com.nexusflow.nexusflowbackend.repository;

import com.nexusflow.nexusflowbackend.model.Empresa;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface EmpresaRepository extends MongoRepository<Empresa, String> {
    // Aquí puedes agregar búsquedas personalizadas luego, como:
    // Optional<Empresa> findByNit(String nit);
}