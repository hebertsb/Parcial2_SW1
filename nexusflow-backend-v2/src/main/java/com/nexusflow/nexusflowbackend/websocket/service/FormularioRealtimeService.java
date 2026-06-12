package com.nexusflow.nexusflowbackend.websocket.service;

import com.nexusflow.nexusflowbackend.model.Formulario_Nodo;
import com.nexusflow.nexusflowbackend.repository.FormularioNodoRepository;
import com.nexusflow.nexusflowbackend.websocket.dto.CampoFormularioMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class FormularioRealtimeService {

    private final FormularioNodoRepository nodoRepository;

    /**
     * Procesa un cambio granular en un campo de formulario.
     * Mantiene Alta Cohesión al encapsular toda la lógica de formularios en tiempo real.
     */
    public void procesarCampo(CampoFormularioMessage mensaje) {
        if (mensaje.formularioId() == null) return;

        Optional<Formulario_Nodo> opNodo = nodoRepository.findById(mensaje.formularioId());
        if (opNodo.isEmpty()) {
            log.warn("Formulario_Nodo no encontrado para el ID: {}", mensaje.formularioId());
            return;
        }

        Formulario_Nodo nodo = opNodo.get();
        List<Map<String, Object>> campos = nodo.getEsquema_campos();
        if (campos == null) return;

        boolean campoActualizado = false;

        // Dependiendo del atributo, podemos tener lógica de inserción, eliminación o actualización
        if ("crear".equals(mensaje.atributo())) {
            // Asumimos que valor es un mapa con la definición del campo
            if (mensaje.valor() instanceof Map) {
                campos.add((Map<String, Object>) mensaje.valor());
                campoActualizado = true;
            }
        } else if ("eliminar".equals(mensaje.atributo())) {
            final String fieldIdToDelete = mensaje.campoId();
            campoActualizado = campos.removeIf(c -> fieldIdToDelete.equals(c.get("id")) || fieldIdToDelete.equals(c.get("name")));
        } else {
            // Actualizar atributo de un campo existente
            for (Map<String, Object> campo : campos) {
                String idCampo = (String) campo.getOrDefault("id", campo.get("name"));
                if (mensaje.campoId().equals(idCampo)) {
                    campo.put(mensaje.atributo(), mensaje.valor());
                    campoActualizado = true;
                    break;
                }
            }
        }

        if (campoActualizado) {
            nodo.setEsquema_campos(campos);
            nodoRepository.save(nodo);
            log.debug("Formulario guardado con éxito. ID: {}", mensaje.formularioId());
        }
    }
}
