package com.nexusflow.nexusflowbackend.service;

import com.nexusflow.nexusflowbackend.model.Formulario_Nodo;
import com.nexusflow.nexusflowbackend.repository.FormularioNodoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class WorkflowService {

    @Autowired
    private FormularioNodoRepository nodoRepository;

    /**
     * Exporta el flujo en formato estructurado UML 2.5 para la documentación.
     * Esto es lo que pondrás en el PDF de la tesis.
     */
    public Map<String, Object> exportarModeloLogico(String politicaId) {
        // CAMBIA ESTA LÍNEA:
        List<Formulario_Nodo> nodos = nodoRepository.buscarPorPolitica(politicaId);

        Map<String, Object> export = new HashMap<>();
        export.put("metadatos", Map.of(
                "estandar", "UML 2.5 Activity Diagram",
                "herramienta", "NexusFlow CASE Tool",
                "fecha_generacion", LocalDateTime.now()
        ));

        // El resto del código sigue igual...
        Map<String, List<Formulario_Nodo>> swimlanes = nodos.stream()
                .collect(Collectors.groupingBy(n -> n.getUnidad_id() != null ? n.getUnidad_id() : "SIN_ASIGNAR"));

        export.put("calles", swimlanes);

        return export;
    }
}