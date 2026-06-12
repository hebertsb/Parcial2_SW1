package com.nexusflow.nexusflowbackend.service;

import com.nexusflow.nexusflowbackend.dto.WorkflowDTO;
import com.nexusflow.nexusflowbackend.model.Politica;
import com.nexusflow.nexusflowbackend.model.Formulario_Nodo;
import com.nexusflow.nexusflowbackend.model.Tramite;
import com.nexusflow.nexusflowbackend.repository.PoliticaRepository;
import com.nexusflow.nexusflowbackend.repository.FormularioNodoRepository;
import com.nexusflow.nexusflowbackend.repository.TramiteRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.stream.Collectors;

@Slf4j
@Service
public class PoliticaService {

    @Autowired
    private PoliticaRepository politicaRepository;

    @Autowired
    private FormularioNodoRepository formularioNodoRepository; // <--- Este es el nombre que definiste

    @Autowired
    private TramiteRepository tramiteRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    /**
     * CU-08: Crea la política base.
     * Aquí podrías validar que el nombre no esté repetido en la misma empresa.
     */
    public Politica crearPolitica(Politica politica) {
        if (politica.getEsta_activa() == null) {
            politica.setEsta_activa(true);
        }
        if (politica.getEmpresa_id() == null || politica.getEmpresa_id().isBlank()) {
            politica.setEmpresa_id("EMP-001");
        }
        politica.setDuracion_estandar_dias(normalizarDuracion(politica.getDuracion_estandar_dias()));
        return politicaRepository.save(politica);
    }

    /**
     * Actualiza los datos base de la política: nombre, estado y SLA.
     */
    public Politica actualizarBase(String id, Politica cambios) {
        return politicaRepository.findById(id).map(actual -> {
            Integer duracionAnterior = actual.getDuracion_estandar_dias();
            boolean duracionCambiada = false;

            if (cambios.getNombre() != null && !cambios.getNombre().isBlank()) {
                actual.setNombre(cambios.getNombre().trim());
            }
            if (cambios.getTipo_flujo() != null && !cambios.getTipo_flujo().isBlank()) {
                actual.setTipo_flujo(cambios.getTipo_flujo().trim());
            }
            if (cambios.getEsta_activa() != null) {
                actual.setEsta_activa(cambios.getEsta_activa());
                if (Boolean.TRUE.equals(cambios.getEsta_activa()) && actual.getFecha_activacion() == null) {
                    actual.setFecha_activacion(java.time.LocalDateTime.now());
                }
            }
            if (cambios.getDuracion_estandar_dias() != null) {
                Integer nuevaDuracion = normalizarDuracion(cambios.getDuracion_estandar_dias());
                duracionCambiada = !nuevaDuracion.equals(duracionAnterior);
                actual.setDuracion_estandar_dias(nuevaDuracion);
            }
            if (cambios.getEmpresa_id() != null && !cambios.getEmpresa_id().isBlank()) {
                actual.setEmpresa_id(cambios.getEmpresa_id());
            }

            Politica guardada = politicaRepository.save(actual);

            if (duracionCambiada) {
                actualizarTramitesActivosPorPolitica(guardada);
            }

            return guardada;
        }).orElseThrow(() -> new RuntimeException("Política no encontrada con id: " + id));
    }

    private Integer normalizarDuracion(Integer duracion) {
        int valor = duracion == null ? 5 : duracion;
        if (valor < 1) valor = 1;
        if (valor > 365) valor = 365;
        return valor;
    }

    private void actualizarTramitesActivosPorPolitica(Politica politica) {
        if (politica == null || politica.getId() == null || politica.getDuracion_estandar_dias() == null) {
            return;
        }

        LocalDateTime ahora = LocalDateTime.now();
        List<Tramite> tramitesActivos = tramiteRepository.findAll().stream()
                .filter(t -> politica.getId().equals(t.getPolitica_id()))
                .filter(t -> t.getFecha_inicio() != null)
                .filter(t -> !"finalizado".equalsIgnoreCase(t.getEstado()) && !"rechazado".equalsIgnoreCase(t.getEstado()))
                .toList();

        for (Tramite tramite : tramitesActivos) {
            tramite.setFecha_limite(tramite.getFecha_inicio().plusDays(politica.getDuracion_estandar_dias()));
            tramite.setFecha_ultima_actualizacion(ahora);
            tramite.setSemaforizacion(calcularSemaforo(tramite.getFecha_inicio(), tramite.getFecha_limite()));
            Tramite guardado = tramiteRepository.save(tramite);
            notificarCambioTramite(guardado);
        }
    }

    private String calcularSemaforo(LocalDateTime inicio, LocalDateTime limite) {
        if (inicio == null || limite == null) return "Verde";

        LocalDateTime ahora = LocalDateTime.now();
        if (ahora.isAfter(limite)) return "Rojo";

        long tiempoTotal = Duration.between(inicio, limite).toMinutes();
        long tiempoTranscurrido = Duration.between(inicio, ahora).toMinutes();
        if (tiempoTotal <= 0) return "Rojo";

        double porcentaje = (double) tiempoTranscurrido / tiempoTotal;
        if (porcentaje >= 0.75) return "Rojo";
        if (porcentaje >= 0.40) return "Amarillo";
        return "Verde";
    }

    private void notificarCambioTramite(Tramite tramite) {
        messagingTemplate.convertAndSend(
                "/topic/tramite/" + tramite.getId() + "/estado",
                new com.nexusflow.nexusflowbackend.websocket.dto.EstadoTramiteMessage(
                        tramite.getId(),
                        tramite.getNodo_actual_id(),
                        tramite.getEstado(),
                        "SYSTEM-SLA"
                )
        );
    }

    /**
     * CU-09 y CU-10: Actualiza el esquema dinámico.
     * Recibe un WorkflowDTO para validar el polimorfismo de los nodos.
     * ✅ ACTIVA AUTOMÁTICAMENTE LA POLÍTICA después de guardar el esquema
     */
    public Politica actualizarEsquema(String id, WorkflowDTO esquemaDto) {
        // Validar que el DTO no sea nulo
        if (esquemaDto == null) {
            throw new IllegalArgumentException("El DTO del esquema no puede ser nulo");
        }
        
        // Validar que al menos pasos o relaciones existan
        if ((esquemaDto.getPasos() == null || esquemaDto.getPasos().isEmpty()) &&
            (esquemaDto.getRelaciones() == null || esquemaDto.getRelaciones().isEmpty())) {
            throw new IllegalArgumentException("El esquema debe tener al menos pasos o relaciones");
        }

        return politicaRepository.findById(id).map(p -> {
            // Convertimos el DTO de vuelta a un Map para persistirlo como BSON dinámico
            // Esto permite que la política evolucione sin esquemas rígidos
            Map<String, Object> mapaEsquema = new HashMap<>();
            mapaEsquema.put("version", esquemaDto.getVersion());
            mapaEsquema.put("pasos", esquemaDto.getPasos());
            mapaEsquema.put("relaciones", esquemaDto.getRelaciones());
            
            // Guardar campos adicionales si existen
            if (esquemaDto.getTipoFlujo() != null) {
                mapaEsquema.put("tipoFlujo", esquemaDto.getTipoFlujo());
            }
            if (esquemaDto.getFormularios() != null) {
                mapaEsquema.put("formularios", esquemaDto.getFormularios());
            }
            if (esquemaDto.getCarriles() != null) {
                mapaEsquema.put("carriles", esquemaDto.getCarriles());
            }
            if (esquemaDto.getMetadatos() != null) {
                mapaEsquema.put("metadatos", esquemaDto.getMetadatos());
            }

            p.setEsquema_workflow(mapaEsquema);
            
            // ✅ ACTIVAR LA POLÍTICA cuando se guarda el flujo (CU-09)
            p.setEsta_activa(true);
            p.setFecha_activacion(java.time.LocalDateTime.now());

            Politica guardada = politicaRepository.save(p);

            log.info("✅ Esquema guardado y POLÍTICA ACTIVADA - pasos: {}, relaciones: {}",
                     esquemaDto.getPasos() != null ? esquemaDto.getPasos().size() : 0,
                     esquemaDto.getRelaciones() != null ? esquemaDto.getRelaciones().size() : 0);
            
            // Validar que realmente se guardó
            if (guardada.getEsquema_workflow() == null || guardada.getEsquema_workflow().get("pasos") == null) {
                log.error("⚠️ ERROR: Esquema NO se guardó correctamente para política {}", id);
                throw new RuntimeException("Error al persistir esquema: datos incompletos");
            }
            
            return guardada;
        }).orElseThrow(() -> new RuntimeException("Política no encontrada con id: " + id));
    }

    /**
     * Obtener todas las políticas (Global).
     */
    public List<Politica> listarTodas() {
        return politicaRepository.findAll();
    }

    /**
     * Listar políticas por empresa (Multi-tenant).
     */
    public List<Politica> listarPorEmpresa(String empresaId) {
        return politicaRepository.findAll().stream()
                .filter(p -> p.getEmpresa_id().equals(empresaId))
                .toList();
    }

    /**
     * CU-11: Guarda la configuración del formulario de un nodo específico.
     * Este es el corazón de tus formularios dinámicos.
     */
    public Formulario_Nodo guardarConfiguracionNodo(Formulario_Nodo nodo) {
        return formularioNodoRepository.save(nodo);
    }

    public Politica obtenerPorId(String id) {
        return politicaRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Política no encontrada con ID: " + id));
    }

    /**
     * Verifica la consistencia de los IDs entre el esquema visual y los documentos guardados.
     * Vital para que la exportación XMI (UML 2.5) funcione correctamente.
     */
    public void verificarConsistenciaGrafica(String politicaId) {
        Politica politica = politicaRepository.findById(politicaId)
                .orElseThrow(() -> new RuntimeException("Política no encontrada"));

        // Corregido: Usamos 'formularioNodoRepository'
        final String searchId = politicaId;
        List<Formulario_Nodo> nodos = formularioNodoRepository.findAll().stream()
                .filter(n -> n.getPolitica_id().equals(searchId))
                .toList();

        // Sincronizamos con id_visual que es el que usa Enterprise Architect
        Set<String> idsExistentes = nodos.stream()
                .map(n -> n.getId_visual() != null ? n.getId_visual() : n.getId_nodo())
                .collect(Collectors.toSet());

        System.out.println("=== VERIFICACIÓN DE INTEGRIDAD UML: " + politica.getNombre() + " ===");

        // Validamos que existan enlaces antes de procesar
        if (politica.getEsquema_workflow() != null && politica.getEsquema_workflow().containsKey("enlaces")) {
            Object enlacesRaw = politica.getEsquema_workflow().get("enlaces");
            if (enlacesRaw instanceof List<?> enlaces) {
                for (Object rawEnlace : enlaces) {
                    if (!(rawEnlace instanceof Map<?, ?> enlace)) {
                        continue;
                    }

                    String from = enlace.get("from") != null ? enlace.get("from").toString() : null;
                    String to = enlace.get("to") != null ? enlace.get("to").toString() : null;

                    // Verificamos si los IDs de las flechas existen en la lista de nodos
                    if (from != null && !idsExistentes.contains(from)) {
                        System.err.println("⚠️ ERROR UML: El origen visual '" + from + "' no está mapeado en la BD.");
                    }
                    if (to != null && !idsExistentes.contains(to)) {
                        System.err.println("⚠️ ERROR UML: El destino visual '" + to + "' no está mapeado en la BD.");
                    }
                }
            }
        }
        System.out.println("=== FIN DE LA VERIFICACIÓN ===");
    }
}