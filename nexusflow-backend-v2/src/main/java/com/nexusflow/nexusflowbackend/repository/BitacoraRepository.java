package com.nexusflow.nexusflowbackend.repository;

import com.nexusflow.nexusflowbackend.model.Bitacora;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Repositorio de Bitácora con queries personalizadas para analítica e IA.
 *
 * Proporciona acceso eficiente a los registros de auditoría
 * que alimentan el motor de aprendizaje en FastAPI.
 *
 * NOTA: Se usan @Query explícitos porque los campos del modelo
 * usan snake_case (tramite_id, fecha_hora) y Spring Data interpreta
 * los guiones bajos como separadores de propiedades anidadas.
 */
@Repository
public interface BitacoraRepository extends MongoRepository<Bitacora, String> {

    /**
     * Obtiene todos los registros de bitácora de un trámite específico.
     * Usado por: TramiteService.obtenerBitacoraPorTramite()
     */
    @Query("{ 'tramite_id': ?0 }")
    List<Bitacora> findByTramiteId(String tramiteId);

    /**
     * Filtra registros por tipo de acción (APROBAR, OBSERVAR, etc.).
     * Usado por: AnalyticsService para métricas de rendimiento.
     */
    @Query("{ 'accion': ?0 }")
    List<Bitacora> findByAccion(String accion);

    /**
     * Filtra registros por estado del trámite al momento de la acción.
     * Usado por: Motor de ML para construir features de entrenamiento.
     */
    @Query("{ 'estado': ?0 }")
    List<Bitacora> findByEstado(String estado);

    /**
     * Obtiene registros de un trámite ordenados por fecha.
     * Usado por: Reconstrucción del historial cronológico.
     */
    @Query(value = "{ 'tramite_id': ?0 }", sort = "{ 'fecha_hora': 1 }")
    List<Bitacora> findByTramiteIdOrderByFechaHora(String tramiteId);

    /**
     * Obtiene registros en un rango de fechas.
     * Usado por: Reportes analíticos y entrenamiento periódico del modelo ML.
     */
    @Query("{ 'fecha_hora': { $gte: ?0, $lte: ?1 } }")
    List<Bitacora> findByFechaHoraBetween(LocalDateTime desde, LocalDateTime hasta);

    /**
     * Cuenta registros por acción (para estadísticas).
     */
    @Query(value = "{ 'accion': ?0 }", count = true)
    long countByAccion(String accion);

    /**
     * Cuenta registros por estado (para métricas de distribución).
     */
    @Query(value = "{ 'estado': ?0 }", count = true)
    long countByEstado(String estado);
}