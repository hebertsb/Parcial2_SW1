package com.nexusflow.nexusflowbackend.controller;

import com.nexusflow.nexusflowbackend.model.Bitacora;
import com.nexusflow.nexusflowbackend.model.Tramite;
import com.nexusflow.nexusflowbackend.repository.BitacoraRepository;
import com.nexusflow.nexusflowbackend.repository.TramiteRepository;
import com.nexusflow.nexusflowbackend.service.NotificacionService;
import com.nexusflow.nexusflowbackend.service.WebPushService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/notificaciones")
@CrossOrigin(origins = "*") // Para conexión con Angular/Flutter
public class NotificacionController {

    @Autowired
    private NotificacionService notificacionService;

    @Autowired
    private TramiteRepository tramiteRepository;

    @Autowired
    private WebPushService webPushService;

    @Autowired
    private BitacoraRepository bitacoraRepository;

    /**
     * Funcionarios que ya trabajaron el trámite (registrados en bitácora),
     * excluyendo al cliente dueño y al solicitante actual.
     * Si hay alguno, la solicitud de corrección va a ellos (nodo A ← nodo B),
     * no al cliente — el cliente ya fue validado en el primer nodo.
     */
    private Set<String> funcionariosPrevios(Tramite tramite, String solicitanteId) {
        Set<String> previos = new LinkedHashSet<>();

        // 1. Historial del trámite — CU-14 (responderComoFuncionario) guarda
        //    "completadoPor" con el id del funcionario que aprobó cada nodo.
        if (tramite.getHistorial() != null) {
            for (Map<String, Object> h : tramite.getHistorial()) {
                Object cp = h.get("completadoPor");
                if (cp instanceof String uid && esFuncionarioPrevio(uid, tramite, solicitanteId)) {
                    previos.add(uid);
                }
            }
        }

        // 2. Bitácora — otros flujos (ejecutarTransicion) registran usuario_id.
        for (Bitacora b : bitacoraRepository.findByTramiteIdOrderByFechaHora(tramite.getId())) {
            String uid = b.getUsuario_id();
            if (esFuncionarioPrevio(uid, tramite, solicitanteId)) {
                previos.add(uid);
            }
        }
        return previos;
    }

    private boolean esFuncionarioPrevio(String uid, Tramite tramite, String solicitanteId) {
        if (uid == null || uid.isBlank()) return false;
        if (uid.equals(tramite.getCliente_id())) return false;
        if (uid.equals(solicitanteId)) return false;
        if (uid.startsWith("SISTEMA")) return false;
        return true;
    }

    /**
     * GET: A quién iría la solicitud de corrección de este trámite.
     * El editor lo usa para ajustar el texto del botón.
     * Respuesta: { "tipo": "funcionarios" | "cliente" }
     */
    @GetMapping("/solicitud-edicion/destino/{tramiteId}")
    public ResponseEntity<?> destinoSolicitud(@PathVariable String tramiteId, Authentication auth) {
        Tramite tramite = tramiteRepository.findById(tramiteId).orElse(null);
        if (tramite == null) {
            return ResponseEntity.ok(Map.of("tipo", "cliente"));
        }
        Set<String> previos = funcionariosPrevios(tramite, auth.getName());
        return ResponseEntity.ok(Map.of("tipo", previos.isEmpty() ? "cliente" : "funcionarios"));
    }

    /**
     * GET: Obtener todas las notificaciones NO LEÍDAS del usuario autenticado
     * URL: http://localhost:9090/api/notificaciones/no-leidas
     * Headers: Authorization: Bearer <token>
     */
    @GetMapping("/no-leidas")
    public ResponseEntity<?> obtenerNoLeidas(Authentication auth) {
        String usuarioId = auth.getName();
        return ResponseEntity.ok(notificacionService.obtenerNoLeidas(usuarioId));
    }

    /**
     * GET: Contar cuántas notificaciones NO LEÍDAS tiene el usuario
     * URL: http://localhost:9090/api/notificaciones/contador
     * Headers: Authorization: Bearer <token>
     * Respuesta: {"count": 3}
     */
    @GetMapping("/contador")
    public ResponseEntity<Map<String, Long>> contarNoLeidas(Authentication auth) {
        String usuarioId = auth.getName();
        Map<String, Long> response = new HashMap<>();
        response.put("count", notificacionService.contarNoLeidas(usuarioId));
        return ResponseEntity.ok(response);
    }

    /**
     * PUT: Marcar una notificación específica como LEÍDA
     * URL: http://localhost:9090/api/notificaciones/{id}/leer
     */
    @PutMapping("/{id}/leer")
    public ResponseEntity<?> marcarComoLeida(@PathVariable String id) {
        notificacionService.marcarComoLeida(id);
        return ResponseEntity.ok(Map.of("mensaje", "Notificación marcada como leída"));
    }

    /**
     * PUT: Marcar TODAS las notificaciones del usuario como leídas
     * URL: http://localhost:9090/api/notificaciones/marcar-todas-leidas
     */
    @PutMapping("/marcar-todas-leidas")
    public ResponseEntity<?> marcarTodasLeidas(Authentication auth) {
        String usuarioId = auth.getName();
        notificacionService.marcarTodasLeidas(usuarioId);
        return ResponseEntity.ok(Map.of("mensaje", "Todas marcadas como leídas"));
    }

    /**
     * POST: El funcionario solicita corrección de un documento al cliente dueño del trámite.
     * Crea notificación persistente (campana) + Web Push dirigido al cliente,
     * llegue donde llegue (panel principal, móvil, app cerrada).
     * Body: { tramiteId, docKey, docNombre, mensaje }
     */
    @PostMapping("/solicitud-edicion")
    public ResponseEntity<?> solicitarEdicion(@RequestBody Map<String, String> body, Authentication auth) {
        String tramiteId = body.get("tramiteId");
        String docKey    = body.getOrDefault("docKey", "");
        String docNombre = body.getOrDefault("docNombre", "el documento");
        String autor     = body.getOrDefault("autor", "Un funcionario");
        String mensaje   = body.getOrDefault("mensaje", "Se solicita corregir " + docNombre);

        if (tramiteId == null || tramiteId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "tramiteId requerido"));
        }

        Tramite tramite = tramiteRepository.findById(tramiteId).orElse(null);
        if (tramite == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Trámite no encontrado: " + tramiteId));
        }

        String url = "/notif-doc?doc=" + java.net.URLEncoder.encode(docKey, java.nio.charset.StandardCharsets.UTF_8)
                + "&tramiteId=" + java.net.URLEncoder.encode(tramiteId, java.nio.charset.StandardCharsets.UTF_8)
                + "&nombre=" + java.net.URLEncoder.encode(docNombre, java.nio.charset.StandardCharsets.UTF_8);

        String solicitanteId = auth.getName();
        Set<String> previos = funcionariosPrevios(tramite, solicitanteId);

        // También incluir al funcionario actualmente asignado (puede ser el siguiente en el flujo)
        String asignadoId = tramite.getFuncionario_asignado_id();
        if (asignadoId != null && !asignadoId.isBlank()
                && !asignadoId.equals(solicitanteId)
                && !asignadoId.equals(tramite.getCliente_id())) {
            previos.add(asignadoId);
        }

        if (!previos.isEmpty()) {
            String msgFunc = autor + " encontró observaciones en \"" + docNombre
                    + "\" y solicita tu revisión en el editor colaborativo";
            for (String funcId : previos) {
                notificacionService.notificarSolicitudEdicion(funcId, tramiteId, docKey, docNombre, msgFunc);
                webPushService.sendToUser(funcId, "✏️ NexusFlow — Solicitud de revisión", msgFunc, url);
            }
            return ResponseEntity.ok(Map.of("ok", true, "destinatario", "funcionarios", "cantidad", previos.size()));
        }

        // Primer nodo: la corrección le toca al cliente dueño del trámite
        String clienteId = tramite.getCliente_id();
        notificacionService.notificarSolicitudEdicion(clienteId, tramiteId, docKey, docNombre, mensaje);
        webPushService.sendToUser(clienteId, "✏️ NexusFlow — Solicitud de corrección", mensaje, url);

        return ResponseEntity.ok(Map.of("ok", true, "destinatario", "cliente", "clienteId", clienteId));
    }

    /**
     * GET: Todas las notificaciones del usuario (leídas y no leídas)
     * URL: http://localhost:9090/api/notificaciones/mis-notificaciones
     */
    @GetMapping("/mis-notificaciones")
    public ResponseEntity<?> obtenerTodas(Authentication auth) {
        String usuarioId = auth.getName();
        return ResponseEntity.ok(notificacionService.obtenerTodas(usuarioId));
    }
}