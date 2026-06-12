package com.nexusflow.nexusflowbackend.service;

import com.nexusflow.nexusflowbackend.model.Tramite;
import com.nexusflow.nexusflowbackend.repository.NotificacionRepository;
import com.nexusflow.nexusflowbackend.repository.TramiteRepository;
import com.nexusflow.nexusflowbackend.repository.UsuarioRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class SemaforoNotificacionScheduler {

    private final TramiteRepository tramiteRepository;
    private final NotificacionRepository notificacionRepository;
    private final UsuarioRepository usuarioRepository;
    private final NotificacionService notificacionService;

    public SemaforoNotificacionScheduler(
            TramiteRepository tramiteRepository,
            NotificacionRepository notificacionRepository,
            UsuarioRepository usuarioRepository,
            NotificacionService notificacionService) {
        this.tramiteRepository = tramiteRepository;
        this.notificacionRepository = notificacionRepository;
        this.usuarioRepository = usuarioRepository;
        this.notificacionService = notificacionService;
    }

    @Scheduled(fixedDelayString = "${nexusflow.alertas.semaforo.interval-ms:60000}")
    public void revisarSemaforosActivos() {
        List<Tramite> tramites = tramiteRepository.findAll();
        LocalDateTime ahora = LocalDateTime.now();

        for (Tramite tramite : tramites) {
            if (!esActivo(tramite)) {
                continue;
            }

            String colorActual = calcularColor(tramite.getFecha_inicio(), tramite.getFecha_limite(), ahora);
            if (!"Amarillo".equals(colorActual) && !"Rojo".equals(colorActual)) {
                continue;
            }

            long horasRestantes = calcularHorasRestantes(tramite.getFecha_limite(), ahora);
            notificarSiCorresponde(tramite, colorActual, horasRestantes);
        }
    }

    private boolean esActivo(Tramite tramite) {
        if (tramite == null) return false;
        String estado = tramite.getEstado();
        return estado != null && !"finalizado".equalsIgnoreCase(estado) && !"rechazado".equalsIgnoreCase(estado);
    }

    private String calcularColor(LocalDateTime inicio, LocalDateTime limite, LocalDateTime ahora) {
        if (inicio == null || limite == null) return "Verde";
        if (ahora.isAfter(limite)) return "Rojo";

        long tiempoTotal = Duration.between(inicio, limite).toMinutes();
        long tiempoTranscurrido = Duration.between(inicio, ahora).toMinutes();
        if (tiempoTotal <= 0) return "Rojo";

        double porcentaje = (double) tiempoTranscurrido / tiempoTotal;
        if (porcentaje >= 0.75) return "Rojo";
        if (porcentaje >= 0.40) return "Amarillo";
        return "Verde";
    }

    private long calcularHorasRestantes(LocalDateTime limite, LocalDateTime ahora) {
        if (limite == null) return 0L;
        return Math.max(Duration.between(ahora, limite).toHours(), 0L);
    }

    private void notificarSiCorresponde(Tramite tramite, String color, long horasRestantes) {
        if (tramite.getId() == null) return;

        String tipo = "SEMAFORO_" + color.toUpperCase();

        if ("Amarillo".equals(color)) {
            // Amarillo: transparencia para el cliente
            notificarUsuario(tramite.getCliente_id(), tramite.getId(), tipo, color, horasRestantes);
            return;
        }

        if ("Rojo".equals(color) && tramite.getFuncionario_asignado_id() != null && !tramite.getFuncionario_asignado_id().isBlank()) {
            // Rojo: atención operativa del funcionario responsable
            notificarUsuario(tramite.getFuncionario_asignado_id(), tramite.getId(), tipo, color, horasRestantes);
        }
    }

    private void notificarUsuario(String usuarioId, String tramiteId, String tipo, String color, long horasRestantes) {
        if (usuarioId == null || usuarioId.isBlank()) {
            return;
        }

        boolean yaExiste = notificacionRepository.existsByUsuarioIdAndTramiteIdAndTipo(usuarioId, tramiteId, tipo);
        if (yaExiste) {
            return;
        }

        usuarioRepository.findById(usuarioId).ifPresent(usuario ->
                notificacionService.notificarSemaforo(usuario.getId(), tramiteId, color, horasRestantes)
        );
    }
}