package com.nexusflow.nexusflowbackend.service;

import com.nexusflow.nexusflowbackend.model.*;
import com.nexusflow.nexusflowbackend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class DashboardService {

    @Autowired
    private TramiteRepository tramiteRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private PoliticaRepository politicaRepository;

    public Map<String, Object> obtenerDashboard(String empresaId) {
        List<Tramite> tramites = tramiteRepository.findAll().stream()
                .filter(t -> {
                    Politica p = politicaRepository.findById(t.getPolitica_id()).orElse(null);
                    return p != null && empresaId.equals(p.getEmpresa_id());
                })
                .toList();

        long totalTramites = tramites.size();
        long pendientes = tramites.stream().filter(t -> "pendiente".equals(t.getEstado())).count();
        long enProgreso = tramites.stream().filter(t -> "en_progreso".equals(t.getEstado())).count();
        long finalizados = tramites.stream().filter(t -> "finalizado".equals(t.getEstado())).count();

        Map<String, Long> porPrioridad = new HashMap<>();
        porPrioridad.put("Alta", tramites.stream().filter(t -> "Alta".equals(t.getPrioridad())).count());
        porPrioridad.put("Media", tramites.stream().filter(t -> "Media".equals(t.getPrioridad())).count());
        porPrioridad.put("Baja", tramites.stream().filter(t -> "Baja".equals(t.getPrioridad())).count());

        Map<String, Long> porSemaforo = new HashMap<>();
        porSemaforo.put("Rojo", tramites.stream().filter(t -> "Rojo".equals(t.getSemaforizacion())).count());
        porSemaforo.put("Amarillo", tramites.stream().filter(t -> "Amarillo".equals(t.getSemaforizacion())).count());
        porSemaforo.put("Verde", tramites.stream().filter(t -> "Verde".equals(t.getSemaforizacion())).count());

        long usuariosActivos = usuarioRepository.findAll().stream()
                .filter(u -> empresaId.equals(u.getEmpresa_id()) && u.isEsta_activo())
                .count();

        long politicasActivas = politicaRepository.findAll().stream()
                .filter(p -> empresaId.equals(p.getEmpresa_id()) && p.getEsta_activa())
                .count();

        return Map.of(
                "totalTramites", totalTramites,
                "pendientes", pendientes,
                "enProgreso", enProgreso,
                "finalizados", finalizados,
                "porPrioridad", porPrioridad,
                "porSemaforo", porSemaforo,
                "usuariosActivos", usuariosActivos,
                "politicasActivas", politicasActivas,
                "fechaGeneracion", java.time.LocalDateTime.now()
        );
    }
}