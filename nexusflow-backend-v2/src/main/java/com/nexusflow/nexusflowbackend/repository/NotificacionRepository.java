package com.nexusflow.nexusflowbackend.repository;

import com.nexusflow.nexusflowbackend.model.Notificacion;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import java.util.List;

public interface NotificacionRepository extends MongoRepository<Notificacion, String> {

    List<Notificacion> findByUsuarioIdOrderByFechaCreacionDesc(String usuarioId);

    @Query("{ 'usuarioId': ?0, 'leida': false }")
    List<Notificacion> findNoLeidas(String usuarioId);

    long countByUsuarioIdAndLeidaFalse(String usuarioId);

    boolean existsByUsuarioIdAndTramiteIdAndTipo(String usuarioId, String tramiteId, String tipo);
}