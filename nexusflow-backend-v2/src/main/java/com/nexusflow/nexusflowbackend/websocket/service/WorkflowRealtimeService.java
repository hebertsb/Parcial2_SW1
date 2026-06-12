package com.nexusflow.nexusflowbackend.websocket.service;

import com.nexusflow.nexusflowbackend.model.Politica;
import com.nexusflow.nexusflowbackend.repository.PoliticaRepository;
import com.nexusflow.nexusflowbackend.websocket.dto.EditorCambioDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowRealtimeService {

    private final PoliticaRepository politicaRepository;

    /**
     * Procesa los cambios granulares del editor visual.
     * Mantiene un bajo acoplamiento con WebSocket delegando a este servicio transaccional.
     */
    public void procesarCambioEditor(EditorCambioDto dto) {
        if (dto.politicaId() == null) return;

        Optional<Politica> opPolitica = politicaRepository.findById(dto.politicaId());
        if (opPolitica.isEmpty()) {
            log.warn("Política no encontrada para ID: {}", dto.politicaId());
            return;
        }

        Politica politica = opPolitica.get();
        Map<String, Object> esquema = politica.getEsquema_workflow();

        if (esquema == null) {
            esquema = new HashMap<>();
            esquema.put("pasos", new ArrayList<>());
            esquema.put("relaciones", new ArrayList<>());
            politica.setEsquema_workflow(esquema);
        }

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> pasos = (List<Map<String, Object>>) esquema.computeIfAbsent("pasos", k -> new ArrayList<>());
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> relaciones = (List<Map<String, Object>>) esquema.computeIfAbsent("relaciones", k -> new ArrayList<>());

        Map<String, Object> payloadMap = null;
        if (dto.payload() instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> tempMap = (Map<String, Object>) dto.payload();
            payloadMap = tempMap;
        }

        boolean esquemaActualizado = false;

        switch (dto.tipo()) {
            case "paso_creado":
                if (payloadMap != null) {
                    pasos.add(payloadMap);
                    esquemaActualizado = true;
                }
                break;
            case "paso_movido":
            case "paso_actualizado":
                if (payloadMap != null && payloadMap.containsKey("id")) {
                    for (Map<String, Object> paso : pasos) {
                        if (payloadMap.get("id").equals(paso.get("id"))) {
                            paso.putAll(payloadMap);
                            esquemaActualizado = true;
                            break;
                        }
                    }
                }
                break;
            case "paso_eliminado":
                if (payloadMap != null && payloadMap.containsKey("id")) {
                    final String targetId = (String) payloadMap.get("id");
                    esquemaActualizado = pasos.removeIf(p -> targetId.equals(p.get("id")));
                    // Eliminar relaciones conectadas (soporta ambos nombres de campo origen/padreId y destino/destinoId)
                    esquemaActualizado |= relaciones.removeIf(r -> 
                        targetId.equals(r.get("origen")) || 
                        targetId.equals(r.get("padreId")) || 
                        targetId.equals(r.get("destino")) || 
                        targetId.equals(r.get("destinoId"))
                    );
                }
                break;
            case "relacion_creada":
                if (payloadMap != null) {
                    relaciones.add(payloadMap);
                    esquemaActualizado = true;
                }
                break;
            case "relacion_actualizada":
            case "condicion_actualizada":
                if (payloadMap != null && payloadMap.containsKey("id")) {
                    for (Map<String, Object> relacion : relaciones) {
                        if (payloadMap.get("id").equals(relacion.get("id"))) {
                            relacion.putAll(payloadMap);
                            esquemaActualizado = true;
                            break;
                        }
                    }
                }
                break;
            case "relacion_eliminada":
                if (payloadMap != null && payloadMap.containsKey("id")) {
                    final String relId = (String) payloadMap.get("id");
                    esquemaActualizado = relaciones.removeIf(r -> relId.equals(r.get("id")));
                }
                break;
            default:
                log.info("Tipo de cambio no procesado: {}", dto.tipo());
        }

        if (esquemaActualizado) {
            politicaRepository.save(politica);
            log.debug("Política guardada con éxito (ID: {}).", dto.politicaId());
        }
    }
}
