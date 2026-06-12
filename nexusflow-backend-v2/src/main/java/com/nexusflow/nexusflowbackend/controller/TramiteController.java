package com.nexusflow.nexusflowbackend.controller;

import com.nexusflow.nexusflowbackend.model.Tramite;
import com.nexusflow.nexusflowbackend.service.TramiteService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tramites")
@CrossOrigin(origins = "*") // Crucial para la conexión con Flutter o React
public class TramiteController {

    @Autowired
    private TramiteService tramiteService;

    /**
     * POST: Iniciar un nuevo trámite
     * URL: http://localhost:9090/api/tramites/iniciar
     */
    @PostMapping("/iniciar")
    public ResponseEntity<?> iniciar(@RequestBody Map<String, Object> request) {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            String usuarioLogueadoId = auth.getName();

            boolean esPersonalAutorizado = auth.getAuthorities().stream()
                    .anyMatch(a -> a.getAuthority().equals("ROL-SUPER") ||
                            a.getAuthority().equals("ROL-ADMIN") ||
                            a.getAuthority().equals("ROL-FUNCIONARIO"));

            String clienteIdBody = request.get("cliente_id") != null ? request.get("cliente_id").toString() : null;
            String politicaId = request.get("politica_id") != null ? request.get("politica_id").toString() : null;
            Integer duracion = null;
            Object durObj = request.get("duracionDias");
            if (durObj != null) {
                try {
                    duracion = Integer.parseInt(durObj.toString());
                } catch (Exception ignored) {}
            }

            if (clienteIdBody == null || politicaId == null) {
                return ResponseEntity.badRequest().body("Error: cliente_id o politica_id son nulos");
            }

            if (!esPersonalAutorizado && !usuarioLogueadoId.equals(clienteIdBody)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body("Error: No puedes iniciar un trámite para otro cliente.");
            }

            Tramite nuevoTramite = tramiteService.iniciarNuevoTramite(clienteIdBody, politicaId, duracion);
            return ResponseEntity.ok(nuevoTramite);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error interno: " + e.getMessage());
        }
    }

    /**
     * GET: Obtener un trámite específico por su ID
     * URL: http://localhost:9090/api/tramites/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<Tramite> obtenerPorId(@PathVariable String id) {
        return tramiteService.obtenerPorId(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * GET: Listar todos los trámites de un cliente específico
     * URL: http://localhost:9090/api/tramites/cliente/{clienteId}
     */
    @GetMapping("/cliente/{clienteId}")
    public ResponseEntity<List<Tramite>> listarPorCliente(@PathVariable String clienteId) {
        List<Tramite> lista = tramiteService.obtenerTodosPorCliente(clienteId);
        if (lista.isEmpty()) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(lista);
    }

    /**
     * PUT: Actualizar los datos de un trámite (Llenar formulario)
     * URL: http://localhost:9090/api/tramites/{id}/datos
     */
    @PutMapping("/{id}/datos")
    public ResponseEntity<?> actualizarDatos(@PathVariable String id, @RequestBody Map<String, Object> requestBody) {
        try {
            Object datosRaw = requestBody.get("datos");
            if (!(datosRaw instanceof Map<?, ?> datosMapRaw)) {
                return ResponseEntity.badRequest().body("Error: Se requiere 'datos' como objeto JSON.");
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> nuevosDatos = (Map<String, Object>) datosMapRaw;
            String usuarioId = (String) requestBody.get("usuario_id");

            if (usuarioId == null) {
                return ResponseEntity.badRequest().body("Error: Se requiere 'usuario_id' para validar permisos.");
            }

            Tramite actualizado = tramiteService.actualizarDatos(id, nuevosDatos, usuarioId);
            return ResponseEntity.ok(actualizado);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error al actualizar: " + e.getMessage());
        }
    }

    /**
     * POST: Invitar a un colaborador (Invitados LECTURA/EDICION)
     * URL: http://localhost:9090/api/tramites/{id}/invitar
     */
    @PostMapping("/{id}/invitar")
    public ResponseEntity<?> invitarColaborador(@PathVariable String id, @RequestBody Map<String, String> request) {
        try {
            String usuarioInvitadoId = request.get("usuario_id");
            String nivelPermiso = request.get("permiso");

            tramiteService.invitarColaborador(id, usuarioInvitadoId, nivelPermiso);
            return ResponseEntity.ok("{\"mensaje\": \"Colaborador añadido correctamente\"}");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    /**
     * POST: Ejecutar Transición de Nodo (Aprobar/Mover proceso)
     * URL: http://localhost:9090/api/tramites/{id}/transicion
     */
    @PostMapping("/{id}/transicion")
    public ResponseEntity<?> ejecutarTransicion(@PathVariable String id, @RequestBody Map<String, String> request) {
        try {
            String nodoDestino = request.get("nodo_destino");
            String usuarioId = request.get("usuario_id");
            String accion = request.get("accion");

            if (usuarioId == null || usuarioId.isBlank()) {
                Authentication auth = SecurityContextHolder.getContext().getAuthentication();
                if (auth != null) {
                    usuarioId = auth.getName();
                }
            }

            if (usuarioId == null || usuarioId.isBlank()) {
                return ResponseEntity.badRequest().body("Error: Se requiere usuario_id para ejecutar la transición.");
            }

            if (accion == null || accion.isBlank()) {
                accion = "APROBAR";
            }

            Tramite resultado = tramiteService.ejecutarTransicion(id, nodoDestino, usuarioId, accion);
            return ResponseEntity.ok(resultado);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    /**
     * GET: Ver la Bitácora de un trámite (Audit Trail)
     * URL: http://localhost:9090/api/tramites/{id}/bitacora
     */
    @GetMapping("/{id}/bitacora")
    public ResponseEntity<?> obtenerBitacora(@PathVariable String id) {
        try {
            return ResponseEntity.ok(tramiteService.obtenerBitacoraPorTramite(id));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    /**
     * GET: Bandeja de entrada del Funcionario (CU-13)
     * URL: http://localhost:9090/api/tramites/bandeja/{unidadId}
     */
    @GetMapping("/bandeja/{unidadId}")
    public ResponseEntity<?> obtenerBandeja(
            @PathVariable String unidadId,
            @RequestParam(required = false) String estado,
            @RequestParam(required = false) String semaforo,
            @RequestParam(required = false) Integer pagina,
            @RequestParam(required = false) Integer limite) {
        return ResponseEntity.ok(tramiteService.obtenerBandejaPorUnidad(unidadId, estado, semaforo, pagina, limite));
    }

    /**
     * POST: Subir evidencia física (PDF/Imagen)
     * URL: http://localhost:9090/api/tramites/{id}/evidencia
     */
    @PostMapping("/{id}/evidencia")
    public ResponseEntity<?> subirArchivo(
            @PathVariable String id,
            @RequestParam("file") MultipartFile file,
            @RequestParam("usuario_id") String usuarioId) {
        return ResponseEntity.ok(tramiteService.subirEvidencia(id, file, usuarioId));
    }

    /**
     * DELETE: Eliminar una evidencia física y su registro
     * URL: http://localhost:9090/api/tramites/{id}/evidencia/{nombreArchivo}
     * Ejemplo: http://localhost:9090/api/tramites/ID/evidencia/1776484519443_p1.pdf
     */
    @DeleteMapping("/{id}/evidencia/{nombreArchivo:.+}")
    public ResponseEntity<?> eliminarArchivo(@PathVariable String id, @PathVariable String nombreArchivo) {
        try {
            Tramite actualizado = tramiteService.eliminarEvidencia(id, nombreArchivo);
            return ResponseEntity.ok(actualizado);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    // ============================================================
    // CU-12: POST /api/tramites — iniciar desde JWT (nuevo esquema de pasos)
    // ============================================================
    @PostMapping
    public ResponseEntity<?> iniciarTramite(@RequestBody Map<String, Object> req) {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            String clienteId = auth.getName();
            String politicaId = req.get("politicaId") != null ? req.get("politicaId").toString() : null;
            Integer duracion = null;
            Object durObj = req.get("duracionDias");
            if (durObj != null) {
                try { duracion = Integer.parseInt(durObj.toString()); } catch (Exception ignored) {}
            }

            if (politicaId == null || politicaId.isBlank()) {
                return ResponseEntity.badRequest().body("Se requiere politicaId");
            }
            Tramite tramite = tramiteService.iniciarDesdeEsquema(politicaId, clienteId, duracion);
            return ResponseEntity.ok(tramite);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    // ============================================================
    // CU-12: GET /api/tramites/mis-tramites — trámites del usuario autenticado
    // ============================================================
    @GetMapping("/mis-tramites")
    public ResponseEntity<?> misTramites() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            String clienteId = auth.getName();
            return ResponseEntity.ok(tramiteService.obtenerMisTramites(clienteId));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    // ============================================================
    // CU-12: GET /api/tramites/{id}/formulario-actual
    // ============================================================
    @GetMapping("/{id}/formulario-actual")
    public ResponseEntity<?> formularioActual(@PathVariable String id) {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            String clienteId = auth.getName();
            return ResponseEntity.ok(tramiteService.obtenerFormularioActual(id, clienteId));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    // ============================================================
    // CU-12: POST /api/tramites/{id}/responder — guardar respuestas y avanzar
    // ============================================================
    @PostMapping("/{id}/responder")
    public ResponseEntity<?> responder(@PathVariable String id, @RequestBody Map<String, Object> req) {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            String clienteId = auth.getName();
            String nodoId = (String) req.get("nodoId");
            @SuppressWarnings("unchecked")
            Map<String, Object> respuestas = (Map<String, Object>) req.get("respuestas");
            if (nodoId == null || respuestas == null) {
                return ResponseEntity.badRequest().body("Se requieren nodoId y respuestas");
            }
            return ResponseEntity.ok(tramiteService.responder(id, nodoId, respuestas, clienteId));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    // ============================================================
    // CU-14: POST /api/tramites/{id}/responder-funcionario — funcionario guarda y avanza
    // ============================================================
    @PostMapping("/{id}/responder-funcionario")
    public ResponseEntity<?> responderFuncionario(@PathVariable String id, @RequestBody Map<String, Object> req) {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            String funcionarioId = auth != null ? auth.getName() : null;
            if (funcionarioId == null || funcionarioId.isBlank()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No autenticado");
            }
            String nodoId = (String) req.get("nodoId");
            @SuppressWarnings("unchecked")
            Map<String, Object> respuestas = req.get("respuestas") instanceof Map<?, ?> m
                    ? (Map<String, Object>) m : new HashMap<>();
            if (nodoId == null || nodoId.isBlank()) {
                return ResponseEntity.badRequest().body("Se requiere nodoId");
            }
            return ResponseEntity.ok(tramiteService.responderComoFuncionario(id, nodoId, respuestas, funcionarioId));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    /**
     * GET /api/tramites/{id}/consulta-publica
     * Endpoint sin autenticación: permite a familiares/visitantes consultar
     * el estado básico de un trámite usando su código.
     * No expone datos sensibles del formulario.
     */
    @GetMapping("/{id}/consulta-publica")
    public ResponseEntity<?> consultaPublica(@PathVariable String id) {
        return tramiteService.obtenerPorId(id)
                .map(t -> {
                    Map<String, Object> resumen = new java.util.LinkedHashMap<>();
                    resumen.put("id", t.getId());
                    resumen.put("nombre_tramite", t.getNombre_tramite());
                    resumen.put("estado", t.getEstado());
                    resumen.put("semaforizacion", t.getSemaforizacion());
                    resumen.put("fecha_inicio", t.getFecha_inicio());
                    resumen.put("fecha_limite", t.getFecha_limite());
                    resumen.put("fecha_fin", t.getFecha_fin());
                    // Historial simplificado: solo nombres de nodos y fechas
                    if (t.getHistorial() != null) {
                        var histSimple = t.getHistorial().stream().map(h -> {
                            Map<String, Object> e = new java.util.LinkedHashMap<>();
                            e.put("paso", h.getOrDefault("nodoNombre", h.getOrDefault("nodoId", "Paso")));
                            e.put("fecha", h.getOrDefault("completadoEn", ""));
                            return e;
                        }).toList();
                        resumen.put("historial", histSimple);
                    }
                    return ResponseEntity.ok(resumen);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/test")
    public ResponseEntity<String> test() {
        return ResponseEntity.ok("Controlador de Trámites funcionando correctamente");
    }
}