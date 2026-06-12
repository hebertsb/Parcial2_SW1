package com.nexusflow.nexusflowbackend.repository;

import com.nexusflow.nexusflowbackend.model.Usuario;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface UsuarioRepository extends MongoRepository<Usuario, String> {

    // Usamos @Query para que Spring no se confunda con el guion bajo
    @Query("{ 'correo_electronico' : ?0 }")
    Optional<Usuario> buscarPorEmailQuery(String email);
}