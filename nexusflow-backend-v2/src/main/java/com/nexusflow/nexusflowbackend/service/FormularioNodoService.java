package com.nexusflow.nexusflowbackend.service;

import com.nexusflow.nexusflowbackend.model.Formulario_Nodo;
import com.nexusflow.nexusflowbackend.repository.FormularioNodoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class FormularioNodoService {

    @Autowired
    private FormularioNodoRepository nodoRepo;

    /**
     * CU-11: Configura los campos que tendrá el formulario de un nodo.
     */
    public Formulario_Nodo configurarCampos(String idDoc, List<Map<String, Object>> nuevosCampos) {
        Formulario_Nodo nodo = nodoRepo.findById(idDoc)
                .orElseThrow(() -> new RuntimeException("Nodo no encontrado en MongoDB"));

        // Seteamos la lista de campos dinámicos
        nodo.setEsquema_campos(nuevosCampos);

        return nodoRepo.save(nodo);
    }

    public List<Formulario_Nodo> obtenerPorPolitica(String politicaId) {
        return nodoRepo.findAll().stream()
                .filter(n -> n.getPolitica_id().equals(politicaId))
                .toList();
    }
}