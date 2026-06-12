package com.nexusflow.nexusflowbackend.service;

import com.nexusflow.nexusflowbackend.model.Notificacion;
import com.nexusflow.nexusflowbackend.repository.NotificacionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class NotificacionService {

    @Autowired
    private NotificacionRepository notificacionRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    public Notificacion crearNotificacion(String usuarioId, String tramiteId,
                                          String politicaId, String tipo,
                                          String titulo, String mensaje,
                                          String icono, String color) {
        Notificacion notificacion = new Notificacion();
        notificacion.setUsuarioId(usuarioId);
        notificacion.setTramiteId(tramiteId);
        notificacion.setPoliticaId(politicaId);
        notificacion.setTipo(tipo);
        notificacion.setTitulo(titulo);
        notificacion.setMensaje(mensaje);
        notificacion.setIcono(icono);
        notificacion.setColor(color);
        notificacion.setLeida(false);
        notificacion.setFechaCreacion(LocalDateTime.now());

        Notificacion saved = notificacionRepository.save(notificacion);

        Map<String, Object> payload = new HashMap<>();
        payload.put("id", saved.getId());
        payload.put("titulo", saved.getTitulo());
        payload.put("mensaje", saved.getMensaje());
        payload.put("tipo", saved.getTipo());
        payload.put("icono", saved.getIcono());
        payload.put("color", saved.getColor());
        payload.put("tramiteId", saved.getTramiteId());

        messagingTemplate.convertAndSendToUser(usuarioId, "/queue/notificaciones", payload);
        messagingTemplate.convertAndSend("/topic/notificaciones/" + usuarioId, payload);

        return saved;
    }

    public void notificarTareaAsignada(String funcionarioId, String tramiteId, String nombreTarea) {
        crearNotificacion(funcionarioId, tramiteId, null, "TAREA_ASIGNADA",
                "📋 Nueva tarea", "Se te asignó: " + nombreTarea, "bell", "primary");
    }

    public Notificacion notificarSemaforo(String usuarioId, String tramiteId, String color, long horasRestantes) {
        String colorNormalizado = normalizarColor(color);
        String titulo;
        String mensaje;
        String icono;
        String colorNotificacion;

        if ("Rojo".equals(colorNormalizado)) {
            titulo = "🔴 Trámite en estado crítico";
            mensaje = "Tu trámite está por vencerse o ya venció. Horas restantes: " + horasRestantes + ".";
            icono = "warning";
            colorNotificacion = "danger";
        } else {
            titulo = "🟡 Trámite en advertencia";
            mensaje = "Tu trámite ya consumió buena parte del tiempo estimado. Horas restantes: " + horasRestantes + ".";
            icono = "hourglass_empty";
            colorNotificacion = "warning";
        }

        return crearNotificacion(usuarioId, tramiteId, null, "SEMAFORO_" + colorNormalizado.toUpperCase(),
                titulo, mensaje, icono, colorNotificacion);
    }

    /**
     * Notificación persistente de solicitud de edición/corrección de un documento.
     * Llega a la campana del usuario aunque no tenga el editor abierto (polling/STOMP).
     */
    public Notificacion notificarSolicitudEdicion(String usuarioId, String tramiteId,
                                                  String docKey, String docNombre,
                                                  String mensaje) {
        Notificacion n = new Notificacion();
        n.setUsuarioId(usuarioId);
        n.setTramiteId(tramiteId);
        n.setTipo("EDICION_SOLICITADA");
        n.setTitulo("✏️ Solicitud de corrección");
        n.setMensaje(mensaje);
        n.setIcono("edit_document");
        n.setColor("warning");
        n.setDocKey(docKey);
        n.setDocNombre(docNombre);
        n.setLeida(false);
        n.setFechaCreacion(LocalDateTime.now());

        Notificacion saved = notificacionRepository.save(n);

        Map<String, Object> payload = new HashMap<>();
        payload.put("id", saved.getId());
        payload.put("titulo", saved.getTitulo());
        payload.put("mensaje", saved.getMensaje());
        payload.put("tipo", saved.getTipo());
        payload.put("icono", saved.getIcono());
        payload.put("color", saved.getColor());
        payload.put("tramiteId", saved.getTramiteId());
        payload.put("docKey", saved.getDocKey());
        payload.put("docNombre", saved.getDocNombre());
        messagingTemplate.convertAndSendToUser(usuarioId, "/queue/notificaciones", payload);
        messagingTemplate.convertAndSend("/topic/notificaciones/" + usuarioId, payload);

        return saved;
    }

    public List<Notificacion> obtenerNoLeidas(String usuarioId) {
        return notificacionRepository.findNoLeidas(usuarioId);
    }

    public long contarNoLeidas(String usuarioId) {
        return notificacionRepository.countByUsuarioIdAndLeidaFalse(usuarioId);
    }

    public void marcarComoLeida(String notificacionId) {
        Notificacion n = notificacionRepository.findById(notificacionId).orElseThrow();
        n.setLeida(true);
        notificacionRepository.save(n);
    }

    public void marcarTodasLeidas(String usuarioId) {
        List<Notificacion> noLeidas = notificacionRepository.findNoLeidas(usuarioId);
        noLeidas.forEach(n -> n.setLeida(true));
        notificacionRepository.saveAll(noLeidas);
    }

    public List<Notificacion> obtenerTodas(String usuarioId) {
        return notificacionRepository.findByUsuarioIdOrderByFechaCreacionDesc(usuarioId);
    }

    private String normalizarColor(String color) {
        if (color == null) {
            return "Amarillo";
        }

        String normalizado = color.trim().toLowerCase();
        if ("rojo".equals(normalizado)) return "Rojo";
        if ("amarillo".equals(normalizado)) return "Amarillo";
        return "Amarillo";
    }
}