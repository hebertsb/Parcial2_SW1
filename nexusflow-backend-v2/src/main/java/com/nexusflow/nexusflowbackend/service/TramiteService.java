package com.nexusflow.nexusflowbackend.service;

import com.nexusflow.nexusflowbackend.model.*;
import com.nexusflow.nexusflowbackend.repository.*;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.multipart.MultipartFile;
import java.nio.file.*;
import java.util.*;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;

@Service
public class TramiteService {

    @Autowired
    private TramiteRepository tramiteRepository;

    @Autowired
    private BitacoraRepository bitacoraRepository;

    @Autowired
    private PoliticaRepository politicaRepository;

    @Autowired
    private FormularioNodoRepository nodoRepository;

    @Autowired
    private UsuarioService usuarioService;

    @Autowired
    private PythonAIService pythonAIService;

    @Autowired
    private NotificacionService notificacionService;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private WebPushService webPushService;

    @Autowired
    private MongoTemplate mongoTemplate;

    @Value("${storage.location}")
    private String storageLocation;

    // ============================================================
    // CU-12: INICIAR NUEVO TRÁMITE (CON NOTIFICACIONES Y ASIGNACIÓN DE FUNCIONARIO)
    // ============================================================
    /**
     * Inicia un trámite basado en el Diagrama de Persistencia.
     * CU-12: Incluye validación de duplicados, metadatos para IA,
     * NOTIFICACIONES y ASIGNACIÓN AUTOMÁTICA del primer funcionario responsable.
     */
    public Tramite iniciarNuevoTramite(String clienteId, String politicaId) {
        return iniciarNuevoTramite(clienteId, politicaId, null);
    }

    public Tramite iniciarNuevoTramite(String clienteId, String politicaId, Integer duracionDias) {

        // --- VALIDACIÓN DE SEGURIDAD (CU-12) ---
        boolean tieneActivo = tramiteRepository.findAll().stream()
                .anyMatch(t -> t.getCliente_id().equals(clienteId)
                        && t.getPolitica_id().equals(politicaId)
                        && !t.getEstado().equals("finalizado")
                        && !t.getEstado().equals("rechazado"));

        if (tieneActivo) {
            throw new RuntimeException("Ya tienes una solicitud de este tipo en proceso.");
        }

        // 1. Validar que la política exista
        politicaRepository.findById(politicaId)
            .orElseThrow(() -> new RuntimeException("Política no encontrada"));

        // 2. Buscar el Nodo de Inicio (NODO_INICIO)
        Formulario_Nodo nodoInicio = nodoRepository.findAll().stream()
                .filter(n -> n.getPolitica_id().equals(politicaId) && "NODO_INICIO".equals(n.getId_nodo()))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("No se encontró el NODO_INICIO para esta política"));

        // 3. Instanciar Trámite
        Tramite nuevo = new Tramite();
        nuevo.setColaboradores(new ArrayList<>());
        nuevo.setCliente_id(clienteId);
        nuevo.setPolitica_id(politicaId);
        nuevo.setNodo_actual_id(nodoInicio.getId());
        nuevo.setFormulario_actual_id(nodoInicio.getId_nodo());
        nuevo.setEstado("pendiente");
        nuevo.setSemaforizacion("Verde");
        nuevo.setPrioridad("Media");

        int duracionPolitica = obtenerDuracionEstimadaPolitica(politicaId);

        LocalDateTime ahora = LocalDateTime.now();
        nuevo.setFecha_inicio(ahora);
        nuevo.setFecha_limite(ahora.plusDays(duracionPolitica));

        nuevo.setDatos_formulario(new HashMap<>());
        nuevo.setHistorial(new ArrayList<>());
        nuevo.setTiempo_total(0.0);

        // Guardamos el trámite
        Tramite guardado = tramiteRepository.save(nuevo);

        // ============================================================
        // 🔄 ASIGNAR FUNCIONARIO RESPONSABLE (para reasignación automática)
        // ============================================================
        Formulario_Nodo primerNodoTask = nodoRepository.findAll().stream()
                .filter(n -> n.getPolitica_id().equals(politicaId) && "TASK".equals(n.getTipo_nodo()))
                .findFirst()
                .orElse(null);

        if (primerNodoTask != null && primerNodoTask.getUnidad_id() != null) {
            String funcionarioId = resolverFuncionarioParaNodo(politicaId, primerNodoTask.getUnidad_id());
            if (funcionarioId != null) {
                guardado.setFuncionario_asignado_id(funcionarioId);
                guardado = tramiteRepository.save(guardado);
            }
        }

        // 4. Registrar en Bitácora
        Map<String, Object> metaIA = new HashMap<>();
        metaIA.put("campos_configurados", nodoInicio.getEsquema_campos() != null ? nodoInicio.getEsquema_campos().size() : 0);
        registrarMovimientoIA(guardado.getId(), clienteId, "INICIO_PROCESO", "pendiente", metaIA);

        // ============================================================
        // 🔔 NOTIFICACIÓN 1: Al CLIENTE que su trámite fue creado
        // ============================================================
        notificacionService.crearNotificacion(
                clienteId,
                guardado.getId(),
                politicaId,
                "TRAMITE_INICIADO",
                "✅ Trámite iniciado correctamente",
                "Tu solicitud ha sido registrada con éxito. Pronto será procesada.",
                "check",
                "success"
        );

        // ============================================================
        // 🔔 NOTIFICACIÓN 2: Notificar a los FUNCIONARIOS de la primera unidad
        // ============================================================
        if (primerNodoTask != null && primerNodoTask.getUnidad_id() != null) {
            List<Usuario> funcionarios = usuarioRepository.findAll().stream()
                    .filter(u -> primerNodoTask.getUnidad_id().equals(u.getUnidad_id()))
                    .toList();

            for (Usuario funcionario : funcionarios) {
                notificacionService.crearNotificacion(
                        funcionario.getId(),
                        guardado.getId(),
                        politicaId,
                        "NUEVO_TRAMITE",
                        "🆕 Nuevo trámite recibido",
                        "El cliente " + clienteId + " ha iniciado un nuevo trámite. Revisa tu bandeja.",
                        "inbox",
                        "primary"
                );
            }
        }

        return guardado;
    }

    // ============================================================
    // MÉTODO PRIVADO: Registrar en Bitácora con metadatos para IA
    // ============================================================
    private void registrarMovimientoIA(String tramiteId, String usuarioId, String accion, String estado, Map<String, Object> metadata) {
        Bitacora b = new Bitacora();
        b.setTramite_id(tramiteId);
        b.setUsuario_id(usuarioId);
        b.setAccion(accion);
        b.setEstado(estado);
        b.setFecha_hora(LocalDateTime.now());
        b.setDetalle_ia(metadata != null ? metadata : new HashMap<>());
        bitacoraRepository.save(b);
    }

    // ============================================================
    // OBTENER TRÁMITE POR ID (con semáforo actualizado)
    // ============================================================
    public Optional<Tramite> obtenerPorId(String id) {
        return tramiteRepository.findById(id).map(t -> {
            String colorActual = calcularColorSemaforo(t.getFecha_inicio(), t.getFecha_limite());
            t.setSemaforizacion(colorActual);

            if (t.getCliente_id() != null) {
                usuarioRepository.findById(t.getCliente_id()).ifPresent(cliente -> {
                    t.setCliente_nombre(cliente.getNombre_completo());
                    t.setCliente_email(cliente.getCorreo_electronico());
                });
            }

            if (t.getFuncionario_asignado_id() != null) {
                usuarioRepository.findById(t.getFuncionario_asignado_id()).ifPresent(funcionario ->
                        t.setFuncionario_asignado_nombre(funcionario.getNombre_completo()));
            }

            // Enriquecer empresa_id desde politica para que cualquier usuario vea los docs S3 correctos
            if (t.getPolitica_id() != null) {
                politicaRepository.findById(t.getPolitica_id()).ifPresent(politica -> {
                    t.setEmpresa_id(politica.getEmpresa_id());
                    t.setPolitica_nombre(politica.getNombre());
                });
            }

            return t;
        });
    }

    // ============================================================
    // LISTAR TRÁMITES POR CLIENTE
    // ============================================================
    public List<Tramite> obtenerTodosPorCliente(String clienteId) {
        return tramiteRepository.findAll().stream()
                .filter(t -> t.getCliente_id().equals(clienteId))
                .toList();
    }

    // ============================================================
    // ACTUALIZAR DATOS DEL FORMULARIO (CON NOTIFICACIÓN)
    // ============================================================
    public Tramite actualizarDatos(String tramiteId, Map<String, Object> nuevosDatos, String usuarioId) {
        Tramite tramite = tramiteRepository.findById(tramiteId)
                .orElseThrow(() -> new RuntimeException("Trámite no encontrado"));

        validarPermiso(tramite, usuarioId, "EDICION");

        tramite.getDatos_formulario().putAll(nuevosDatos);

        Map<String, Object> h = new HashMap<>();
        h.put("accion", "ACTUALIZACION_DATOS");
        h.put("fecha", LocalDateTime.now());
        tramite.getHistorial().add(h);

        Tramite guardado = tramiteRepository.save(tramite);
        registrarMovimientoIA(tramiteId, usuarioId, "LLENADO_FORMULARIO", tramite.getEstado(), null);

        // ============================================================
        // 🔔 NOTIFICACIÓN: Al FUNCIONARIO responsable cuando el cliente llena datos
        // ============================================================
        if (tramite.getFuncionario_asignado_id() != null) {
            notificacionService.crearNotificacion(
                    tramite.getFuncionario_asignado_id(),
                    tramiteId,
                    tramite.getPolitica_id(),
                    "FORMULARIO_LLENADO",
                    "📝 Formulario actualizado",
                    "El cliente ha completado/actualizado el formulario del trámite.",
                    "edit",
                    "info"
            );
        }

        return guardado;
    }

    // ============================================================
    // CU-14: MOTOR DE TRANSICIÓN (CON NOTIFICACIONES EN TIEMPO REAL)
    // ============================================================
    /**
     * MOTOR DE TRANSICIÓN: Mueve el trámite entre nodos, valida permisos y registra para la IA.
     * 🔔 DISPARA NOTIFICACIONES AUTOMÁTICAS EN CADA EVENTO IMPORTANTE
     */
    public Tramite ejecutarTransicion(String tramiteId, String nodoDestinoId, String usuarioId, String tipoAccion) {
        Tramite tramite = tramiteRepository.findById(tramiteId)
                .orElseThrow(() -> new RuntimeException("Trámite no encontrado"));

        String nodoAnteriorId = tramite.getNodo_actual_id();

        // 1. VERIFICACIÓN DE PERMISOS
        validarPermiso(tramite, usuarioId, "EDICION");

        // 1.1 Resolver destino automático por reglas CU-10 cuando no se envía nodo_destino
        // Se usa una variable final para evitar el error de lambda "effectively final"
        String resolvedDestId = nodoDestinoId;
        if (resolvedDestId == null || resolvedDestId.isBlank()) {
            resolvedDestId = resolverNodoDestinoDesdeCondiciones(tramite, usuarioId);
            if (resolvedDestId == null || resolvedDestId.isBlank()) {
                // No se encontró una relación saliente válida: tratamos esto como paso final.
                // El estado final depende de la acción: APROBAR → finalizado, RECHAZAR → rechazado, OBSERVAR → observado.
                String estadoFinal;
                if ("APROBAR".equalsIgnoreCase(tipoAccion)) {
                    estadoFinal = "finalizado";
                } else if ("RECHAZAR".equalsIgnoreCase(tipoAccion)) {
                    estadoFinal = "rechazado";
                } else {
                    estadoFinal = "observado";
                }
                tramite.setEstado(estadoFinal);
                if ("finalizado".equals(estadoFinal)) {
                    tramite.setFecha_fin(LocalDateTime.now());
                }

                Map<String, Object> logIAFinal = new HashMap<>();
                logIAFinal.put("usuario_id", usuarioId);
                logIAFinal.put("accion", tipoAccion + "_FINALIZACION");
                logIAFinal.put("tiempo_en_nodo", calcularTiempo(tramite.getFecha_inicio()));
                logIAFinal.put("nodo_origen", obtenerNombreNodo(nodoAnteriorId));
                logIAFinal.put("nodo_destino", "(final)");

                registrarMovimientoIA(tramite.getId(), usuarioId, "FINALIZAR", tramite.getEstado(), logIAFinal);

                Tramite guardadoFinal = tramiteRepository.save(tramite);

                publicarEstadoTramite(guardadoFinal, usuarioId);

                // Notificar al cliente y (si existe) al funcionario
                notificacionService.crearNotificacion(
                    tramite.getCliente_id(),
                    tramiteId,
                    tramite.getPolitica_id(),
                    "FINALIZADO",
                    "✅ Trámite finalizado",
                    "Tu trámite ha sido finalizado correctamente.",
                    "check",
                    "success"
                );
                if (tramite.getFuncionario_asignado_id() != null) {
                    notificacionService.crearNotificacion(
                        tramite.getFuncionario_asignado_id(),
                        tramiteId,
                        tramite.getPolitica_id(),
                        "FINALIZADO",
                        "Trámite finalizado",
                        "El trámite #" + tramite.getId() + " ha sido finalizado.",
                        "check",
                        "info"
                    );
                }

                return guardadoFinal;
                }
        }

    // 2. BUSCAR EL NODO DESTINO
    final String finalDestId = resolvedDestId;
    Formulario_Nodo siguiente = nodoRepository.findAll().stream()
            .filter(n -> n.getPolitica_id().equals(tramite.getPolitica_id())
                    && coincideNodoDestino(n, finalDestId))
            .findFirst()
            .orElseThrow(() -> new RuntimeException("El nodo destino no es válido para esta política"));

    // 3. ACTUALIZACIÓN DEL ESTADO Y NODO
    String nodoAnteriorNombre = obtenerNombreNodo(nodoAnteriorId);
    tramite.setNodo_actual_id(siguiente.getId());
    tramite.setFormulario_actual_id(siguiente.getId_nodo() != null ? siguiente.getId_nodo() : resolvedDestId);

    String nuevoEstado;
    if ("APROBAR".equalsIgnoreCase(tipoAccion)) {
        nuevoEstado = "en_progreso";
    } else if ("RECHAZAR".equalsIgnoreCase(tipoAccion)) {
        nuevoEstado = "rechazado";
    } else {
        nuevoEstado = "observado";
    }
    tramite.setEstado(nuevoEstado);

    // 4. Si el nodo destino es TASK, asignar un nuevo funcionario
    if ("TASK".equals(siguiente.getTipo_nodo()) && siguiente.getUnidad_id() != null) {
        String nuevoFuncionarioId = resolverFuncionarioParaNodo(tramite.getPolitica_id(), siguiente.getUnidad_id());
        if (nuevoFuncionarioId != null) {
            tramite.setFuncionario_asignado_id(nuevoFuncionarioId);
        }
    }

        // 5. REGISTRO EN BITÁCORA
        Map<String, Object> logIA = new HashMap<>();
        logIA.put("usuario_id", usuarioId);
        logIA.put("accion", tipoAccion);
        logIA.put("tiempo_en_nodo", calcularTiempo(tramite.getFecha_inicio()));
        logIA.put("nodo_origen", nodoAnteriorNombre);
        logIA.put("nodo_destino", siguiente.getNombre_nodo());

        registrarMovimientoIA(tramite.getId(), usuarioId, tipoAccion, tramite.getEstado(), logIA);

        Tramite guardado = tramiteRepository.save(tramite);

        // ============================================================
        // 🔔 NOTIFICACIÓN 1: Al CLIENTE que su trámite cambió de estado
        // ============================================================
        String mensajeEstado;
        String colorNotif;
        if ("APROBAR".equalsIgnoreCase(tipoAccion)) {
            mensajeEstado = "Tu trámite ha sido APROBADO y continúa en proceso.";
            colorNotif = "success";
        } else if ("RECHAZAR".equalsIgnoreCase(tipoAccion)) {
            mensajeEstado = "Tu trámite ha sido RECHAZADO. Revisa las observaciones.";
            colorNotif = "danger";
        } else {
            mensajeEstado = "Tu trámite ha sido OBSERVADO. Se requiere revisión adicional.";
            colorNotif = "warning";
        }

        notificacionService.crearNotificacion(
            tramite.getCliente_id(),
            tramiteId,
            tramite.getPolitica_id(),
            "ESTADO_CAMBIADO",
            "🔄 Estado de tu trámite actualizado",
            mensajeEstado,
            "refresh",
            colorNotif
        );

        // ============================================================
        // 🔔 NOTIFICACIÓN 2: Al NUEVO FUNCIONARIO asignado
        // ============================================================
        if (!nodoAnteriorId.equals(siguiente.getId()) && "TASK".equals(siguiente.getTipo_nodo())
                && tramite.getFuncionario_asignado_id() != null) {
            notificacionService.crearNotificacion(
                    tramite.getFuncionario_asignado_id(),
                    tramiteId,
                    tramite.getPolitica_id(),
                    "TAREA_ASIGNADA",
                    "📋 Nueva tarea asignada",
                    "Tienes una nueva tarea: " + siguiente.getNombre_nodo(),
                    "bell",
                    "primary"
            );
        }

        // ============================================================
        // 🔔 NOTIFICACIÓN 3: Verificar si el trámite llegó al NODO_FIN
        // ============================================================
        if ("NODO_FIN".equals(siguiente.getTipo_nodo())) {
            tramite.setEstado("finalizado");
            guardado = tramiteRepository.save(tramite);

            notificacionService.crearNotificacion(
                    tramite.getCliente_id(),
                    tramiteId,
                    tramite.getPolitica_id(),
                    "TRAMITE_FINALIZADO",
                    "🏁 Trámite finalizado",
                    "Tu trámite ha sido completado exitosamente.",
                    "flag",
                    "success"
            );
        }

        // ============================================================
        // 🔔 NOTIFICACIÓN 4: Verificar VENCIMIENTO PRÓXIMO
        // ============================================================
        verificarYNotificarVencimiento(tramite);

        publicarEstadoTramite(guardado, usuarioId);

        return guardado;
    }

    private void publicarEstadoTramite(Tramite tramite, String usuarioId) {
        if (tramite == null || tramite.getId() == null) {
            return;
        }

        messagingTemplate.convertAndSend(
                "/topic/tramite/" + tramite.getId() + "/estado",
                new com.nexusflow.nexusflowbackend.websocket.dto.EstadoTramiteMessage(
                        tramite.getId(),
                        tramite.getNodo_actual_id(),
                        tramite.getEstado(),
                        usuarioId
                )
        );
    }

    private void publicarActualizacionBandeja(String unidadId, String tramiteId) {
        if (unidadId == null || unidadId.isBlank()) return;
        messagingTemplate.convertAndSend("/topic/bandeja/" + unidadId,
                Map.of("tramiteId", tramiteId != null ? tramiteId : ""));
    }

    /**
     * CU-10: Resuelve el nodo destino aplicando condiciones sobre las relaciones salientes
     * del nodo actual. Si no hay condición que cumpla, usa una relación "siguiente" como fallback.
     */
    private String resolverNodoDestinoDesdeCondiciones(Tramite tramite, String usuarioId) {
        Politica politica = politicaRepository.findById(tramite.getPolitica_id())
                .orElseThrow(() -> new RuntimeException("Política no encontrada para el trámite"));

        Map<String, Object> esquema = politica.getEsquema_workflow();
        if (esquema == null) {
            throw new RuntimeException("La política no tiene esquema_workflow configurado");
        }

        Object relObj = esquema.get("relaciones");
        if (!(relObj instanceof List<?> relListRaw) || relListRaw.isEmpty()) {
            throw new RuntimeException("El esquema_workflow no contiene relaciones para evaluar");
        }

        String nodoActualRef = obtenerReferenciaNodoActual(tramite);
        if (nodoActualRef == null || nodoActualRef.isBlank()) {
            throw new RuntimeException("No se pudo identificar el nodo actual del trámite");
        }

        List<Map<String, Object>> salientes = new ArrayList<>();
        for (Object r : relListRaw) {
            if (!(r instanceof Map<?, ?> rm)) continue;
            @SuppressWarnings("unchecked")
            Map<String, Object> rel = (Map<String, Object>) rm;

            String padreId = stringOrNull(rel.get("padreId"));
            if (padreId == null) padreId = stringOrNull(rel.get("origen"));

            if (nodoActualRef.equals(padreId)) {
                salientes.add(rel);
            }
        }

        if (salientes.isEmpty()) {
            return null;
        }

        // Priorizar relaciones condicionales válidas
        for (Map<String, Object> rel : salientes) {
            Object condObj = rel.get("condicion");
            if (condObj instanceof Map<?, ?> cm) {
                @SuppressWarnings("unchecked")
                Map<String, Object> condicion = (Map<String, Object>) cm;
                if (evaluarCondicion(condicion, tramite, usuarioId)) {
                    String destino = stringOrNull(rel.get("destinoId"));
                    if (destino == null) destino = stringOrNull(rel.get("destino"));
                    if (destino != null) return mapearDestinoANodoId(destino, tramite.getPolitica_id());
                }
            }
        }

        // Fallback: primera relación sin condición o tipo siguiente
        for (Map<String, Object> rel : salientes) {
            String tipo = stringOrNull(rel.get("tipo"));
            Object condObj = rel.get("condicion");
            if (condObj == null || "siguiente".equalsIgnoreCase(tipo)) {
                String destino = stringOrNull(rel.get("destinoId"));
                if (destino == null) destino = stringOrNull(rel.get("destino"));
                if (destino != null) return mapearDestinoANodoId(destino, tramite.getPolitica_id());
            }
        }

        return null;
    }

    private boolean evaluarCondicion(Map<String, Object> condicion, Tramite tramite, String usuarioId) {
        String operador = stringOrNull(condicion.get("operador"));
        if (operador == null || operador.isBlank()) operador = "=";

        String fuente = stringOrNull(condicion.get("fuente"));
        String variableSistema = stringOrNull(condicion.get("variableSistema"));
        String campoId = stringOrNull(condicion.get("campoId"));
        Object esperado = condicion.get("valorEsperado");

        Object actual;
        if ("variable_sistema".equalsIgnoreCase(fuente) || variableSistema != null) {
            actual = resolverVariableSistema(variableSistema, tramite, usuarioId);
        } else {
            actual = (tramite.getDatos_formulario() != null && campoId != null)
                    ? tramite.getDatos_formulario().get(campoId)
                    : null;
        }

        if (actual == null || esperado == null) return false;

        Integer cmp = compararValores(actual, esperado);
        if (cmp == null) return false;

        return switch (operador) {
            case "=" -> cmp == 0;
            case "!=" -> cmp != 0;
            case ">" -> cmp > 0;
            case "<" -> cmp < 0;
            case ">=" -> cmp >= 0;
            case "<=" -> cmp <= 0;
            default -> false;
        };
    }

    private Object resolverVariableSistema(String variable, Tramite tramite, String usuarioId) {
        if (variable == null) return null;
        return switch (variable) {
            case "estado_anterior" -> tramite.getEstado();
            case "rol_solicitante" -> usuarioRepository.findById(tramite.getCliente_id())
                    .map(Usuario::getRol_id)
                    .orElse(null);
            case "departamento_solicitante" -> usuarioRepository.findById(tramite.getCliente_id())
                    .map(Usuario::getUnidad_id)
                    .orElse(null);
            case "dias_transcurridos" -> Duration.between(tramite.getFecha_inicio(), LocalDateTime.now()).toDays();
            case "fecha_actual" -> LocalDate.now().toString();
            default -> null;
        };
    }

    private Integer compararValores(Object a, Object b) {
        Double na = parseNumero(a);
        Double nb = parseNumero(b);
        if (na != null && nb != null) {
            return Double.compare(na, nb);
        }

        LocalDateTime da = parseFecha(a);
        LocalDateTime db = parseFecha(b);
        if (da != null && db != null) {
            return da.compareTo(db);
        }

        String sa = normalizarTexto(a);
        String sb = normalizarTexto(b);
        return sa.compareToIgnoreCase(sb);
    }

    private Double parseNumero(Object v) {
        if (v == null) return null;
        if (v instanceof Number n) return n.doubleValue();
        try {
            return Double.parseDouble(v.toString().trim());
        } catch (Exception e) {
            return null;
        }
    }

    private LocalDateTime parseFecha(Object v) {
        if (v == null) return null;
        if (v instanceof LocalDateTime dt) return dt;
        if (v instanceof LocalDate d) return d.atStartOfDay();
        String s = v.toString().trim();
        try {
            return LocalDateTime.parse(s);
        } catch (Exception ignored) {
        }
        try {
            return LocalDate.parse(s).atStartOfDay();
        } catch (Exception ignored) {
        }
        return null;
    }

    private String normalizarTexto(Object v) {
        String s = v == null ? "" : v.toString().trim();
        if ("true".equalsIgnoreCase(s)) return "SI";
        if ("false".equalsIgnoreCase(s)) return "NO";
        return s;
    }

    private String obtenerReferenciaNodoActual(Tramite tramite) {
        if (tramite.getNodo_actual_id() != null) {
            Optional<Formulario_Nodo> actual = nodoRepository.findById(tramite.getNodo_actual_id());
            if (actual.isPresent()) {
                Formulario_Nodo n = actual.get();
                if (n.getId_nodo() != null && !n.getId_nodo().isBlank()) return n.getId_nodo();
                if (n.getId_visual() != null && !n.getId_visual().isBlank()) return n.getId_visual();
                return n.getId();
            }
        }
        if (tramite.getFormulario_actual_id() != null && !tramite.getFormulario_actual_id().isBlank()) {
            return tramite.getFormulario_actual_id();
        }
        return tramite.getNodo_actual_id();
    }

    private String mapearDestinoANodoId(String destinoRef, String politicaId) {
        List<Formulario_Nodo> nodos = nodoRepository.buscarPorPolitica(politicaId);
        for (Formulario_Nodo n : nodos) {
            if (coincideNodoDestino(n, destinoRef)) {
                return n.getId_nodo() != null ? n.getId_nodo() : destinoRef;
            }
        }
        return destinoRef;
    }

    private boolean coincideNodoDestino(Formulario_Nodo n, String destinoRef) {
        if (destinoRef == null) return false;
        return destinoRef.equals(n.getId_nodo())
                || destinoRef.equals(n.getId_visual())
                || destinoRef.equals(n.getId());
    }

    private String stringOrNull(Object value) {
        if (value == null) return null;
        String s = value.toString().trim();
        return s.isEmpty() ? null : s;
    }

    /**
     * BFS desde el nodo INICIO, devuelve solo nodos tipo TAREA en orden de ejecución del diagrama.
     * Los nodos INICIO, FIN y GATEWAY se excluyen del stepper del cliente.
     */
    private List<Map<String, Object>> pasosTareaEnOrdenFlujo(
            List<Map<String, Object>> pasos, List<Map<String, Object>> relaciones) {

        Map<String, Map<String, Object>> pasoMap = new HashMap<>();
        for (Map<String, Object> p : pasos) {
            String id = (String) p.get("id");
            if (id != null) pasoMap.put(id, p);
        }

        // Punto de arranque: nodo INICIO
        String idInicio = null;
        for (Map<String, Object> p : pasos) {
            if ("INICIO".equals(p.get("tipoPaso"))) {
                idInicio = (String) p.get("id");
                break;
            }
        }

        List<Map<String, Object>> resultado = new ArrayList<>();
        Set<String> visitados = new LinkedHashSet<>();
        Queue<String> cola = new LinkedList<>();

        if (idInicio != null) {
            cola.add(idInicio);
        } else {
            // Fallback: todos los pasos en orden de campo 'orden'
            pasos.stream()
                .sorted(Comparator.comparingInt(p -> {
                    Object o = p.get("orden");
                    return o instanceof Number ? ((Number) o).intValue() : 0;
                }))
                .map(p -> (String) p.get("id"))
                .filter(id -> id != null)
                .forEach(cola::add);
        }

        while (!cola.isEmpty()) {
            String actual = cola.poll();
            if (visitados.contains(actual)) continue;
            visitados.add(actual);

            Map<String, Object> paso = pasoMap.get(actual);
            if (paso != null) {
                String tipo = (String) paso.get("tipoPaso");
                // Solo TAREA (o nulos por compatibilidad) se muestran en el stepper
                if (tipo == null || "TAREA".equals(tipo)) {
                    resultado.add(paso);
                }
            }

            if (relaciones != null) {
                for (Map<String, Object> rel : relaciones) {
                    if (actual.equals(rel.get("padreId"))) {
                        String dest = (String) rel.get("destinoId");
                        if (dest != null && !visitados.contains(dest)) {
                            cola.add(dest);
                        }
                    }
                }
            }
        }

        return resultado;
    }

    private List<Map<String, Object>> extraerListaMapas(Map<String, Object> esquema, String clave) {
        Object raw = esquema != null ? esquema.get(clave) : null;
        if (!(raw instanceof List<?> listaRaw)) {
            return new ArrayList<>();
        }

        List<Map<String, Object>> resultado = new ArrayList<>();
        for (Object item : listaRaw) {
            if (item instanceof Map<?, ?> mapaRaw) {
                Map<String, Object> mapa = new HashMap<>();
                for (Map.Entry<?, ?> entry : mapaRaw.entrySet()) {
                    if (entry.getKey() != null) {
                        mapa.put(entry.getKey().toString(), entry.getValue());
                    }
                }
                resultado.add(mapa);
            }
        }
        return resultado;
    }

    // ============================================================
    // MÉTODO AUXILIAR: Obtener nombre del nodo por ID
    // ============================================================
    private String obtenerNombreNodo(String nodoId) {
        return nodoRepository.findById(nodoId)
                .map(Formulario_Nodo::getNombre_nodo)
                .orElse("Nodo desconocido");
    }

    // ============================================================
    // MÉTODO AUXILIAR: Verificar vencimiento y notificar
    // ============================================================
    private void verificarYNotificarVencimiento(Tramite tramite) {
        if (tramite.getFecha_limite() != null) {
            LocalDateTime ahora = LocalDateTime.now();
            long horasRestantes = Duration.between(ahora, tramite.getFecha_limite()).toHours();

            if (horasRestantes <= 24 && horasRestantes > 0) {
                // Notificar al cliente
                notificacionService.crearNotificacion(
                        tramite.getCliente_id(),
                        tramite.getId(),
                        tramite.getPolitica_id(),
                        "VENCIMIENTO",
                        "⚠️ Trámite por vencer",
                        "Faltan " + horasRestantes + " horas para la fecha límite de tu trámite.",
                        "clock",
                        "warning"
                );

                // Notificar al funcionario responsable
                if (tramite.getFuncionario_asignado_id() != null) {
                    notificacionService.crearNotificacion(
                            tramite.getFuncionario_asignado_id(),
                            tramite.getId(),
                            tramite.getPolitica_id(),
                            "VENCIMIENTO",
                            "⚠️ Trámite por vencer",
                            "El trámite #" + tramite.getId() + " vence en " + horasRestantes + " horas.",
                            "clock",
                            "warning"
                    );
                }
            }
        }
    }

    // ============================================================
    // VALIDAR PERMISOS
    // ============================================================
    private void validarPermiso(Tramite t, String userId, String nivelRequerido) {
        if (t.getCliente_id().equals(userId)) return;

        Usuario usuario = usuarioService.obtenerPorId(userId)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado: " + userId));

        String rolId = usuario.getRol_id();

        if ("ROL-ADMIN".equals(rolId) || "ROL-FUNCIONARIO".equals(rolId) || "ROL-SUPER".equals(rolId)) {
            return;
        }

        boolean tieneAcceso = t.getColaboradores().stream()
                .anyMatch(c -> c.get("usuario_id").equals(userId)
                        && c.get("permiso").equals(nivelRequerido));

        if (!tieneAcceso) {
            throw new RuntimeException("El usuario " + userId + " no tiene permisos de " + nivelRequerido);
        }
    }

    // ============================================================
    // CALCULAR TIEMPO PARA MÉTRICAS IA
    // ============================================================
    private Double calcularTiempo(LocalDateTime fechaInicio) {
        if (fechaInicio == null) return 0.0;
        return (double) Duration.between(fechaInicio, LocalDateTime.now()).toHours();
    }

    // ============================================================
    // INVITAR COLABORADOR
    // ============================================================
    public void invitarColaborador(String tramiteId, String usuarioInvitadoId, String nivelPermiso) {
        Tramite t = tramiteRepository.findById(tramiteId)
                .orElseThrow(() -> new RuntimeException("Trámite no encontrado"));
        Map<String, String> colaborador = new HashMap<>();
        colaborador.put("usuario_id", usuarioInvitadoId);
        colaborador.put("permiso", nivelPermiso);
        t.getColaboradores().add(colaborador);
        tramiteRepository.save(t);

        notificacionService.crearNotificacion(
                usuarioInvitadoId,
                tramiteId,
                t.getPolitica_id(),
                "COLABORADOR_INVITADO",
                "👥 Has sido invitado como colaborador",
                "Has sido invitado al trámite con permiso de " + nivelPermiso,
                "users",
                "info"
        );
    }

    // ============================================================
    // OBTENER BITÁCORA DEL TRÁMITE
    // ============================================================
    public List<Bitacora> obtenerBitacoraPorTramite(String tramiteId) {
        return bitacoraRepository.findByTramiteId(tramiteId);
    }

    // ============================================================
    // CU-13: CALCULAR COLOR DEL SEMÁFORO
    // ============================================================
    public String calcularColorSemaforo(LocalDateTime inicio, LocalDateTime limite) {
        if (inicio == null || limite == null) return "Verde";

        LocalDateTime ahora = LocalDateTime.now();
        if (ahora.isAfter(limite)) return "Rojo";

        long tiempoTotal = Duration.between(inicio, limite).toMinutes();
        long tiempoTranscurrido = Duration.between(inicio, ahora).toMinutes();
        double porcentaje = (double) tiempoTranscurrido / tiempoTotal;

        if (porcentaje >= 0.75) return "Rojo";
        if (porcentaje >= 0.40) return "Amarillo";
        return "Verde";
    }

    // ============================================================
    // CU-13: OBTENER BANDEJA POR UNIDAD
    // ============================================================
    public Map<String, Object> obtenerBandejaPorUnidad(
            String unidadId,
            String filtroEstado,
            String filtroSemaforo,
            Integer pagina,
            Integer limite) {

        // Estrategia 1 (arquitectura antigua): IDs del nodoRepository con tipo TASK
        List<String> nodosDeLaUnidad = nodoRepository.findAll().stream()
                .filter(n -> "TASK".equals(n.getTipo_nodo()) && unidadId.equals(n.getUnidad_id()))
                .map(Formulario_Nodo::getId)
                .toList();

        // Estrategia 2 (CU-12): IDs de funcionarios que pertenecen a esta unidad
        List<String> funcionariosUnidad = usuarioRepository.findAll().stream()
                .filter(u -> unidadId.equals(u.getUnidad_id()))
                .map(Usuario::getId)
                .toList();

        List<Tramite> tramites = tramiteRepository.findAll().stream()
                // Excluir solo los definitivamente cerrados
                .filter(t -> !"finalizado".equals(t.getEstado()) && !"rechazado".equals(t.getEstado()))
                .filter(t ->
                    // 1️⃣ Arch. antigua: nodo del repositorio Formulario_Nodo
                    nodosDeLaUnidad.contains(t.getNodo_actual_id())
                    // 2️⃣ CU-12: tramite en_revision con funcionario asignado de esta unidad
                    || ("en_revision".equals(t.getEstado())
                            && t.getFuncionario_asignado_id() != null
                            && funcionariosUnidad.contains(t.getFuncionario_asignado_id()))
                    // 3️⃣ CU-12: el paso actual en el esquema_workflow tiene unidadId de esta unidad
                    || esPasoDeUnidadCU12(t, unidadId)
                )
                .map(this::enriquecerBandejaItem)
                .sorted(Comparator.comparing(t -> {
                    if ("Rojo".equals(t.getSemaforizacion())) return 1;
                    if ("Amarillo".equals(t.getSemaforizacion())) return 2;
                    return 3;
                }))
                .toList();

        if (filtroEstado != null && !filtroEstado.isBlank()) {
            tramites = tramites.stream()
                    .filter(t -> filtroEstado.equalsIgnoreCase(t.getEstado()))
                    .toList();
        }

        if (filtroSemaforo != null && !filtroSemaforo.isBlank()) {
            tramites = tramites.stream()
                    .filter(t -> filtroSemaforo.equalsIgnoreCase(t.getSemaforizacion()))
                    .toList();
        }

        long pendientes    = tramites.stream().filter(t -> "pendiente".equals(t.getEstado())).count();
        long enProgreso    = tramites.stream().filter(t -> "en_progreso".equals(t.getEstado()) || "en_proceso".equals(t.getEstado())).count();
        long observados    = tramites.stream().filter(t -> "observado".equals(t.getEstado())).count();
        long enRevision    = tramites.stream().filter(t -> "en_revision".equals(t.getEstado())).count();
        long finalizados   = tramites.stream().filter(t -> "finalizado".equals(t.getEstado())).count();

        long verdes   = tramites.stream().filter(t -> "Verde".equals(t.getSemaforizacion())).count();
        long amarillos = tramites.stream().filter(t -> "Amarillo".equals(t.getSemaforizacion())).count();
        long rojos    = tramites.stream().filter(t -> "Rojo".equals(t.getSemaforizacion())).count();

        int paginaActual  = pagina != null && pagina > 0 ? pagina : 1;
        int limiteActual  = limite != null && limite > 0 ? limite : Math.max(tramites.size(), 1);
        int totalPaginas  = (int) Math.ceil((double) tramites.size() / limiteActual);

        List<Tramite> tramitesPaginados = tramites.stream()
                .skip((long) (paginaActual - 1) * limiteActual)
                .limit(limiteActual)
                .toList();

        Map<String, Object> semaforo = new LinkedHashMap<>();
        semaforo.put("verde", verdes);
        semaforo.put("amarillo", amarillos);
        semaforo.put("rojo", rojos);

        Map<String, Object> respuesta = new LinkedHashMap<>();
        respuesta.put("total", tramites.size());
        respuesta.put("pagina_actual", paginaActual);
        respuesta.put("total_paginas", totalPaginas);
        respuesta.put("pendientes", pendientes);
        respuesta.put("en_progreso", enProgreso);
        respuesta.put("en_revision", enRevision);
        respuesta.put("observados", observados);
        respuesta.put("finalizados", finalizados);
        respuesta.put("semaforizacion", semaforo);
        respuesta.put("tramites", tramitesPaginados);

        return respuesta;
    }

    /**
     * CU-12: Verifica si el paso actual del trámite pertenece a la unidad indicada.
     * El diseñador guarda el departamento bajo el campo `departamentoId`.
     */
    @SuppressWarnings("unchecked")
    private boolean esPasoDeUnidadCU12(Tramite tramite, String unidadId) {
        try {
            if (tramite.getNodo_actual_id() == null || tramite.getPolitica_id() == null) return false;
            Politica politica = politicaRepository.findById(tramite.getPolitica_id()).orElse(null);
            if (politica == null || politica.getEsquema_workflow() == null) return false;
            Map<String, Object> esquema = politica.getEsquema_workflow();
            Object pasosRaw = esquema.get("pasos");
            if (!(pasosRaw instanceof List<?>)) return false;
            List<Map<String, Object>> pasos = (List<Map<String, Object>>) pasosRaw;
            // Construir mapa carrilId → departamentoId real (del esquema_workflow)
            Map<String, String> carrilDeptMap = resolverCarriles(esquema);

            String nodoActual = tramite.getNodo_actual_id();
            for (Map<String, Object> paso : pasos) {
                if (nodoActual.equals(paso.get("id"))) {
                    String deptId = resolverDepartamentoId(paso, carrilDeptMap);
                    return unidadId.equals(deptId);
                }
            }
        } catch (Exception ignored) {}
        return false;
    }

    /** Extrae mapa {carrilId → departamentoId} del esquema_workflow. */
    @SuppressWarnings("unchecked")
    private Map<String, String> resolverCarriles(Map<String, Object> esquema) {
        Map<String, String> map = new java.util.HashMap<>();
        Object carrilesRaw = esquema.get("carriles");
        if (carrilesRaw instanceof List<?> carriles) {
            for (Object c : carriles) {
                if (c instanceof Map<?, ?> carril) {
                    Object cid = carril.get("id");
                    Object dept = carril.get("departamentoId");
                    if (cid instanceof String cidStr && dept instanceof String deptStr && !deptStr.isBlank()) {
                        map.put(cidStr, deptStr);
                    }
                }
            }
        }
        return map;
    }

    /**
     * Extrae mapa {carrilId → funcionarioAsignadoId} — asignación rotativa.
     * Tiene prioridad sobre la búsqueda por unidad_id.
     */
    @SuppressWarnings("unchecked")
    private Map<String, String> resolverFuncionariosCarriles(Map<String, Object> esquema) {
        Map<String, String> map = new java.util.HashMap<>();
        Object carrilesRaw = esquema.get("carriles");
        if (carrilesRaw instanceof List<?> carriles) {
            for (Object c : carriles) {
                if (c instanceof Map<?, ?> carril) {
                    Object cid = carril.get("id");
                    Object func = carril.get("funcionarioAsignadoId");
                    if (cid instanceof String cidStr && func instanceof String funcStr && !funcStr.isBlank()) {
                        map.put(cidStr, funcStr);
                    }
                }
            }
        }
        return map;
    }

    /**
     * Dado un paso y el mapa de funcionarios por carril, retorna el funcionarioId
     * directamente asignado al carril que contiene este paso (si existe).
     */
    private String resolverFuncionarioDirecto(Map<String, Object> paso, Map<String, String> funcCarrilMap, Map<String, String> carrilDeptMap) {
        Object raw = paso.get("departamentoId");
        if (raw == null) raw = paso.get("unidadId");
        if (raw == null) raw = paso.get("unidad_id");
        if (raw instanceof String rawStr && !rawStr.isBlank()) {
            // Ver si el rawStr es un carrilId con funcionario asignado
            if (funcCarrilMap.containsKey(rawStr)) return funcCarrilMap.get(rawStr);
            // Ver si hay algún carril cuyo departamentoId coincide y tiene funcionario
            for (Map.Entry<String, String> e : carrilDeptMap.entrySet()) {
                if (e.getValue().equals(rawStr) && funcCarrilMap.containsKey(e.getKey())) {
                    return funcCarrilMap.get(e.getKey());
                }
            }
        }
        Object carrilId = paso.get("carrilId");
        if (carrilId instanceof String cid && funcCarrilMap.containsKey(cid)) return funcCarrilMap.get(cid);
        return null;
    }

    /**
     * Resuelve el departamentoId efectivo de un paso.
     * 1. Usa paso.departamentoId si es un ID real de unidad (existe en BD).
     * 2. Si es un UUID de carril, resuelve via carrilDeptMap.
     * 3. Fallback: carrilId del paso → carrilDeptMap.
     */
    private String resolverDepartamentoId(Map<String, Object> paso, Map<String, String> carrilDeptMap) {
        Object raw = paso.get("departamentoId");
        if (raw == null) raw = paso.get("unidadId");
        if (raw == null) raw = paso.get("unidad_id");
        if (raw instanceof String rawStr && !rawStr.isBlank()) {
            // Si es el ID de un carril, tradúcelo al departamentoId real
            if (carrilDeptMap.containsKey(rawStr)) return carrilDeptMap.get(rawStr);
            return rawStr; // Ya es un ID de departamento/unidad directo
        }
        // Fallback: buscar por carrilId explícito en el paso
        Object carrilId = paso.get("carrilId");
        if (carrilId instanceof String cid && carrilDeptMap.containsKey(cid)) return carrilDeptMap.get(cid);
        return null;
    }

    private Tramite enriquecerBandejaItem(Tramite t) {
        t.setSemaforizacion(calcularColorSemaforo(t.getFecha_inicio(), t.getFecha_limite()));
        t.setTiempo_restante_horas(calcularHorasRestantes(t.getFecha_limite()));

        usuarioRepository.findById(t.getCliente_id()).ifPresent(cliente -> {
            t.setCliente_nombre(cliente.getNombre_completo());
            t.setCliente_email(cliente.getCorreo_electronico());
        });

        politicaRepository.findById(t.getPolitica_id()).ifPresent(politica -> {
            t.setPolitica_nombre(politica.getNombre());
            t.setEmpresa_id(politica.getEmpresa_id()); // Para que frontend sepa en qué bucket S3 buscar
        });

        nodoRepository.findById(t.getNodo_actual_id()).ifPresent(nodo ->
                t.setNodo_actual_nombre(nodo.getNombre_nodo()));

        if (t.getFuncionario_asignado_id() != null) {
            usuarioRepository.findById(t.getFuncionario_asignado_id()).ifPresent(funcionario ->
                    t.setFuncionario_asignado_nombre(funcionario.getNombre_completo()));
        }

        t.setFuncionario_asignado_id(t.getFuncionario_asignado_id());

        return t;
    }

    private Long calcularHorasRestantes(LocalDateTime fechaLimite) {
        if (fechaLimite == null) {
            return null;
        }

        long horas = Duration.between(LocalDateTime.now(), fechaLimite).toHours();
        return Math.max(horas, 0L);
    }

    private int normalizarDuracionDias(Integer duracion) {
        if (duracion == null) return 5;
        int d = duracion.intValue();
        if (d < 1) d = 1;
        if (d > 365) d = 365;
        return d;
    }

    private int obtenerDuracionEstimadaPolitica(String politicaId) {
        return politicaRepository.findById(politicaId)
                .map(Politica::getDuracion_estandar_dias)
                .map(this::normalizarDuracionDias)
                .orElse(5);
    }

    // ============================================================
    // CU-18: PROCESAR INFORME POR VOZ CON IA
    // ============================================================
    public Tramite procesarInformeIA(String tramiteId, String transcripcionVoz) {
        Tramite tramite = tramiteRepository.findById(tramiteId)
                .orElseThrow(() -> new RuntimeException("Trámite no encontrado"));

        Map<String, Object> datosExtraidos = pythonAIService.extraerEntidades(transcripcionVoz);
        tramite.getDatos_formulario().putAll(datosExtraidos);

        registrarMovimientoIA(tramiteId, "SISTEMA_IA", "AUTO_RELLENADO_VOZ", tramite.getEstado(), Map.of("confianza_ia", 0.95));

        return tramiteRepository.save(tramite);
    }

    // ============================================================
    // CU-15: SUBIR EVIDENCIA (CON NOTIFICACIÓN)
    // ============================================================
    public Tramite subirEvidencia(String tramiteId, MultipartFile archivo, String usuarioId) {
        Tramite tramite = tramiteRepository.findById(tramiteId)
                .orElseThrow(() -> new RuntimeException("Trámite no encontrado"));

        try {
            Path rootLocation = Paths.get(storageLocation);
            if (!Files.exists(rootLocation)) {
                Files.createDirectories(rootLocation);
            }

            String nombreArchivo = System.currentTimeMillis() + "_" + archivo.getOriginalFilename();
            Path destino = rootLocation.resolve(nombreArchivo);

            List<String> tiposPermitidos = Arrays.asList("application/pdf", "image/jpeg", "image/png", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

            if (!tiposPermitidos.contains(archivo.getContentType())) {
                throw new RuntimeException("Tipo de archivo no permitido. Solo PDF, JPG, PNG o DOCX.");
            }

            Files.copy(archivo.getInputStream(), destino, StandardCopyOption.REPLACE_EXISTING);

            Map<String, Object> evidencia = new HashMap<>();
            evidencia.put("nombre", archivo.getOriginalFilename());
            evidencia.put("ruta_local", destino.toString());
            evidencia.put("tipo", archivo.getContentType());
            evidencia.put("fecha_subida", LocalDateTime.now());
            evidencia.put("usuario_id", usuarioId);

            if (tramite.getEvidencias() == null) {
                tramite.setEvidencias(new ArrayList<>());
            }
            tramite.getEvidencias().add(evidencia);

            registrarMovimientoIA(tramiteId, usuarioId, "SUBIDA_EVIDENCIA", tramite.getEstado(),
                    Map.of("archivo", archivo.getOriginalFilename(), "path", destino.toString()));

            Tramite guardado = tramiteRepository.save(tramite);

            // 🔔 NOTIFICACIÓN: Al FUNCIONARIO responsable cuando se sube una evidencia
            if (tramite.getFuncionario_asignado_id() != null) {
                notificacionService.crearNotificacion(
                        tramite.getFuncionario_asignado_id(),
                        tramiteId,
                        tramite.getPolitica_id(),
                        "EVIDENCIA_SUBIDA",
                        "📎 Nueva evidencia disponible",
                        "Se ha subido un nuevo documento: " + archivo.getOriginalFilename(),
                        "paperclip",
                        "info"
                );
            }

            return guardado;
        } catch (Exception e) {
            throw new RuntimeException("No se pudo guardar el archivo: " + e.getMessage());
        }
    }

    // ============================================================
    // CU-12 (NUEVO): INICIAR TRÁMITE DESDE esquema_workflow.pasos
    // Usa el nuevo modelo de pasos del diseñador visual (CU-09)
    // ============================================================
    public Tramite iniciarDesdeEsquema(String politicaId, String clienteId) {
        return iniciarDesdeEsquema(politicaId, clienteId, null);
    }

    public Tramite iniciarDesdeEsquema(String politicaId, String clienteId, Integer duracionDias) {
        Politica politica = politicaRepository.findById(politicaId)
            .orElseThrow(() -> new RuntimeException("Política no encontrada con id: " + politicaId));

        if (!Boolean.TRUE.equals(politica.getEsta_activa())) {
            throw new RuntimeException("La política no está activa");
        }

        if (!Boolean.TRUE.equals(politica.getEsta_activa())) {
            throw new RuntimeException("La política no está activa");
        }

        Map<String, Object> esquema = politica.getEsquema_workflow();
        if (esquema == null) throw new RuntimeException("La política no tiene un flujo diseñado todavía");

        List<Map<String, Object>> pasos = extraerListaMapas(esquema, "pasos");
        List<Map<String, Object>> relaciones = extraerListaMapas(esquema, "relaciones");
        if (pasos == null || pasos.isEmpty()) throw new RuntimeException("El flujo no tiene pasos definidos");

        // Buscar nodo INICIO para arrancar desde el comienzo del diagrama
        Map<String, Object> nodoInicio = pasos.stream()
            .filter(p -> "INICIO".equals(p.get("tipoPaso")))
            .findFirst().orElse(null);

        Map<String, Object> primerPaso;
        if (nodoInicio != null) {
            primerPaso = nodoInicio;
        } else {
            // Fallback: primer TAREA por orden (para flujos sin nodo INICIO explícito)
            primerPaso = pasos.stream()
                .filter(p -> !"GATEWAY".equals(p.get("tipoPaso")) && !"FIN".equals(p.get("tipoPaso")))
                .min(Comparator.comparingInt(p -> {
                    Object o = p.get("orden");
                    return o instanceof Number ? ((Number) o).intValue() : 0;
                }))
                .orElseThrow(() -> new RuntimeException("No se encontró un paso inicial en el flujo"));
        }

        String primerPasoId = (String) primerPaso.get("id");
        String primerFormularioId = (String) primerPaso.get("formularioId");

        Tramite nuevo = new Tramite();
        nuevo.setCliente_id(clienteId);
        nuevo.setPolitica_id(politicaId);
        nuevo.setNombre_tramite(politica.getNombre());
        nuevo.setNodo_actual_id(primerPasoId);
        nuevo.setFormulario_actual_id(primerFormularioId);
        nuevo.setEstado("en_proceso");
        nuevo.setSemaforizacion("Verde");
        nuevo.setPrioridad("Media");

        int duracionPolitica = normalizarDuracionDias(politica.getDuracion_estandar_dias());

        LocalDateTime ahora = LocalDateTime.now();
        nuevo.setFecha_inicio(ahora);
        nuevo.setFecha_ultima_actualizacion(ahora);
        nuevo.setFecha_limite(ahora.plusDays(duracionPolitica));
        nuevo.setDatos_formulario(new HashMap<>());
        nuevo.setRespuestas_por_nodo(new HashMap<>());
        nuevo.setHistorial(new ArrayList<>());
        nuevo.setColaboradores(new ArrayList<>());
        nuevo.setEvidencias(new ArrayList<>());

        Tramite guardado = tramiteRepository.save(nuevo);

        notificacionService.crearNotificacion(clienteId, guardado.getId(), politicaId,
            "TRAMITE_INICIADO", "✅ Trámite iniciado",
            "Tu solicitud «" + politica.getNombre() + "» ha sido registrada.",
            "check", "success");

        return guardado;
        }

    // ============================================================
    // CU-12: OBTENER FORMULARIO DEL PASO ACTUAL
    // ============================================================
    public Map<String, Object> obtenerFormularioActual(String tramiteId, String userId) {
        Tramite tramite = tramiteRepository.findById(tramiteId)
                .orElseThrow(() -> new RuntimeException("Trámite no encontrado"));

        // Permitir acceso al cliente propietario, a funcionarios/administradores y a colaboradores.
        // Esto evita que la UI del funcionario obtenga 500 cuando consulta el formulario.
        validarPermiso(tramite, userId, "LECTURA");

        Politica politica = politicaRepository.findById(tramite.getPolitica_id())
                .orElseThrow(() -> new RuntimeException("Política no encontrada"));

        Map<String, Object> esquema = politica.getEsquema_workflow();
        List<Map<String, Object>> pasos = extraerListaMapas(esquema, "pasos");

        String nodoActualId = tramite.getNodo_actual_id();
        Map<String, Object> pasoActual = pasos.stream()
                .filter(p -> nodoActualId.equals(p.get("id")))
                .findFirst().orElseThrow(() -> new RuntimeException("Paso actual no encontrado en el flujo"));

        // Solo es el último paso si está marcado como tal Y no tiene formulario pendiente
        boolean esPasoFinal = Boolean.TRUE.equals(pasoActual.get("esUltimo"))
                || "NODO_FIN".equals(String.valueOf(pasoActual.get("tipo_nodo")));

        // Stepper: solo nodos TAREA en orden de flujo (BFS desde INICIO)
        List<Map<String, Object>> relacionesEsquema = extraerListaMapas(esquema, "relaciones");
        List<Map<String, Object>> pasosTarea = pasosTareaEnOrdenFlujo(pasos, relacionesEsquema);

        Map<String, Object> result = new HashMap<>();
        result.put("tramite", tramite);
        result.put("pasoActual", pasoActual);
        result.put("todosPasos", pasosTarea);
        // IMPORTANTE: No marcamos esUltimoPaso en true si hay formulario, para que el frontend lo renderice
        result.put("esUltimoPaso", esPasoFinal);

        String formularioId = (String) pasoActual.get("formularioId");
        if ((formularioId == null || formularioId.isBlank())
                && tramite.getFormulario_actual_id() != null
                && !tramite.getFormulario_actual_id().isBlank()) {
            formularioId = tramite.getFormulario_actual_id();
        }
        if (formularioId != null && !formularioId.isBlank()) {
            // Leer como Document raw para preservar opciones y arrays anidados
            Document rawForm = mongoTemplate.findById(formularioId, Document.class, "Formulario_Nodo");
            if (rawForm == null) {
                // Fallback: buscar por id_nodo
                rawForm = mongoTemplate.findOne(
                    Query.query(Criteria.where("id_nodo").is(formularioId)),
                    Document.class, "Formulario_Nodo");
            }
            if (rawForm != null) {
                Map<String, Object> formularioMap = documentToMap(rawForm);
                // Renombrar esquema_campos → campos para el frontend
                if (formularioMap.containsKey("esquema_campos") && !formularioMap.containsKey("campos")) {
                    formularioMap.put("campos", formularioMap.remove("esquema_campos"));
                }
                result.put("formulario", formularioMap);
            }
        }

        if (tramite.getRespuestas_por_nodo() != null) {
            Map<String, Object> prev = tramite.getRespuestas_por_nodo().get(nodoActualId);
            if (prev != null) result.put("respuestasPrevias", prev);
        }

        return result;
    }

    // ============================================================
    // CU-12: GUARDAR RESPUESTAS Y AVANZAR AL SIGUIENTE PASO
    // ============================================================
    public Map<String, Object> responder(String tramiteId, String nodoId,
                                          Map<String, Object> respuestas, String clienteId) {
        Tramite tramite = tramiteRepository.findById(tramiteId)
                .orElseThrow(() -> new RuntimeException("Trámite no encontrado"));

        if (!tramite.getCliente_id().equals(clienteId)) {
            throw new RuntimeException("No autorizado");
        }

        // Historial
        if (tramite.getHistorial() == null) tramite.setHistorial(new ArrayList<>());
        Map<String, Object> histEntry = new HashMap<>();
        histEntry.put("nodoId", nodoId);
        histEntry.put("completadoEn", LocalDateTime.now().toString());
        histEntry.put("completadoPor", clienteId);
        tramite.getHistorial().add(histEntry);

        // Leer esquema
        Politica politica = politicaRepository.findById(tramite.getPolitica_id()).orElseThrow();
        Map<String, Object> esquema = politica.getEsquema_workflow();
        List<Map<String, Object>> pasos = extraerListaMapas(esquema, "pasos");
        List<Map<String, Object>> relaciones = extraerListaMapas(esquema, "relaciones");

        // Persistir respuestas del paso actual
        Map<String, Object> pasoActual = pasos.stream()
                .filter(p -> nodoId.equals(p.get("id"))).findFirst().orElse(new HashMap<>());

        if (tramite.getRespuestas_por_nodo() == null) tramite.setRespuestas_por_nodo(new HashMap<>());
        tramite.getRespuestas_por_nodo().put(nodoId, respuestas);
        if (tramite.getDatos_formulario() == null) tramite.setDatos_formulario(new HashMap<>());
        tramite.getDatos_formulario().putAll(respuestas);

        // Guardar labels del paso en labels_por_nodo si vienen en las respuestas bajo __LABELS__ o __labels__
        Object rawLabels = respuestas.containsKey("__LABELS__") ? respuestas.get("__LABELS__") : respuestas.get("__labels__");
        if (rawLabels != null) {
            if (tramite.getLabels_por_nodo() == null) tramite.setLabels_por_nodo(new HashMap<>());
            if (rawLabels instanceof Map<?,?> lm) {
                Map<String, String> labels = new HashMap<>();
                for (Map.Entry<?, ?> entry : lm.entrySet()) {
                    if (entry.getKey() != null && entry.getValue() != null) {
                        labels.put(entry.getKey().toString(), entry.getValue().toString());
                    }
                }
                tramite.getLabels_por_nodo().put(nodoId, labels);
            }
        }

        // Guardar nombre del paso en el historial
        if (tramite.getHistorial() != null && !tramite.getHistorial().isEmpty()) {
            Map<String, Object> lastEntry = tramite.getHistorial().get(tramite.getHistorial().size() - 1);
            if (nodoId.equals(lastEntry.get("nodoId")) && pasoActual.get("nombre") != null) {
                lastEntry.put("nodoNombre", pasoActual.get("nombre"));
            }
        }

        // ============================================================
        // LÓGICA DE FIRMA CRUZADA: el cliente NO puede finalizar solo.
        // Solo finaliza cuando el SIGUIENTE paso no existe Y el actor
        // es FUNCIONARIO/ADMIN, o cuando NO hay paso siguiente de ningún tipo.
        // Si el siguiente paso requiere funcionario → poner en_revision.
        // ============================================================
        String siguientePasoId = resolverSiguientePasoCU12(nodoId, relaciones, tramite);

        // Auto-saltar nodos INICIO, GATEWAY y FIN: son nodos de control, no de captura de datos.
        // Se recorre la cadena hasta llegar a un nodo TAREA o al final del flujo.
        siguientePasoId = saltarNodosControl(siguientePasoId, pasos, relaciones, tramite);

        // Copia efectivamente final requerida por las lambdas de Java
        final String siguientePasoIdFinal = siguientePasoId;

        if (siguientePasoIdFinal != null) {
            // Hay un siguiente paso: avanzar normalmente
            Map<String, Object> siguientePaso = pasos.stream()
                    .filter(p -> siguientePasoIdFinal.equals(p.get("id"))).findFirst().orElse(null);

            // Detectar si el siguiente paso requiere funcionario
            boolean siguienteEsDeFuncionario = false;
            if (siguientePaso != null) {
                // Lógica moderna: Basada en Calles / Swimlanes (departamentoId)
                Object unidadObj = siguientePaso.get("departamentoId");
                if (unidadObj == null) unidadObj = siguientePaso.get("unidadId");
                if (unidadObj == null) unidadObj = siguientePaso.get("unidad_id");
                
                if (unidadObj instanceof String uid && !uid.isBlank() && !uid.equalsIgnoreCase("cliente")) {
                    siguienteEsDeFuncionario = true; // Pertenece a un departamento, por ende es un Funcionario
                } else {
                    // Fallback para flujos antiguos sin carriles
                    Object rol = siguientePaso.get("rol");
                    Object reqFuncionario = siguientePaso.get("requiereFuncionario");
                    if (Boolean.TRUE.equals(reqFuncionario)) siguienteEsDeFuncionario = true;
                    if (rol instanceof String rolStr) {
                        String rolLower = rolStr.toLowerCase();
                        if (rolLower.contains("funcionario") || rolLower.contains("admin") ||
                            rolLower.contains("encargado") || rolLower.contains("ROL-FUNCIONARIO")) {
                            siguienteEsDeFuncionario = true;
                        }
                    }
                }
            }

            if (siguienteEsDeFuncionario) {
                // Poner en revisión: el funcionario debe actuar a continuación
                tramite.setEstado("en_revision");
                tramite.setNodo_actual_id(siguientePasoIdFinal);
                String siguienteFormularioId = siguientePaso != null ? (String) siguientePaso.get("formularioId") : null;
                tramite.setFormulario_actual_id(siguienteFormularioId);
                tramite.setFecha_ultima_actualizacion(LocalDateTime.now());

                // Intentar asignar funcionario del paso siguiente
                if (siguientePaso != null) {
                    Map<String, String> carrilMap = resolverCarriles(politica.getEsquema_workflow());
                    Map<String, String> funcCarrilMap = resolverFuncionariosCarriles(politica.getEsquema_workflow());

                    // 1ª prioridad: funcionario rotativo asignado al carril
                    String funcDirecto = resolverFuncionarioDirecto(siguientePaso, funcCarrilMap, carrilMap);
                    if (funcDirecto != null) {
                        tramite.setFuncionario_asignado_id(funcDirecto);
                        notificacionService.crearNotificacion(funcDirecto, tramiteId, tramite.getPolitica_id(),
                                "TRAMITE_EN_REVISION", "📋 Trámite listo para revisión",
                                "El cliente ha completado su parte. El trámite «" + tramite.getNombre_tramite() + "» espera tu aprobación.",
                                "task", "primary");
                        webPushService.sendToUser(funcDirecto, "📋 NexusFlow — Nuevo trámite",
                                "El trámite «" + tramite.getNombre_tramite() + "» espera tu revisión.", "/");
                        String deptDirecto = resolverDepartamentoId(siguientePaso, carrilMap);
                        publicarActualizacionBandeja(deptDirecto, tramiteId);
                    } else {
                        // 2ª prioridad: buscar por unidad_id
                        String deptId = resolverDepartamentoId(siguientePaso, carrilMap);
                        if (deptId != null && !deptId.isBlank()) {
                            final String uid = deptId;
                            List<Usuario> funcionarios = usuarioRepository.findAll().stream()
                                    .filter(u -> uid.equals(u.getUnidad_id()))
                                    .toList();
                            if (!funcionarios.isEmpty()) {
                                tramite.setFuncionario_asignado_id(funcionarios.get(0).getId());
                                notificacionService.crearNotificacion(
                                        funcionarios.get(0).getId(), tramiteId, tramite.getPolitica_id(),
                                        "TRAMITE_EN_REVISION", "📋 Trámite listo para revisión",
                                        "El cliente ha completado su parte. El trámite «" + tramite.getNombre_tramite() + "» espera tu aprobación.",
                                        "task", "primary");
                                webPushService.sendToUser(funcionarios.get(0).getId(), "📋 NexusFlow — Nuevo trámite",
                                        "El trámite «" + tramite.getNombre_tramite() + "» espera tu revisión.", "/");
                                publicarActualizacionBandeja(deptId, tramiteId);
                            }
                        }
                    }
                }

                tramiteRepository.save(tramite);
                publicarEstadoTramite(tramite, clienteId);

                // Notificar al cliente
                notificacionService.crearNotificacion(clienteId, tramiteId, tramite.getPolitica_id(),
                        "TRAMITE_EN_REVISION",
                        "⏳ Trámite enviado al encargado",
                        "Tu solicitud ha sido enviada al encargado del departamento para su revisión y aprobación.",
                        "hourglass_empty", "info");

                registrarMovimientoIA(tramiteId, clienteId, "LLENADO_FORMULARIO", "en_revision", null);
                Map<String, Object> result = new HashMap<>();
                result.put("tramite", tramite);
                result.put("completado", false);
                result.put("enRevision", true);
                result.put("siguientePaso", siguientePaso);
                return result;
            } else {
                // Siguiente paso es del cliente: avanzar normalmente
                tramite.setNodo_actual_id(siguientePasoIdFinal);
                String siguienteFormularioId = siguientePaso != null ? (String) siguientePaso.get("formularioId") : null;
                tramite.setFormulario_actual_id(siguienteFormularioId);
                tramite.setFecha_ultima_actualizacion(LocalDateTime.now());
                tramiteRepository.save(tramite);
                registrarMovimientoIA(tramiteId, clienteId, "LLENADO_FORMULARIO", tramite.getEstado(), null);

                Map<String, Object> result = new HashMap<>();
                result.put("tramite", tramite);
                result.put("completado", false);
                result.put("siguientePaso", siguientePaso);

                if (siguientePaso != null) {
                    String sigFormId = (String) siguientePaso.get("formularioId");
                    if (sigFormId != null) {
                        nodoRepository.findById(sigFormId).ifPresent(f -> result.put("siguienteFormulario", f));
                    }
                }
                return result;
            }
        } else {
            // No hay siguiente paso: el flujo terminó.
            // saltarNodosControl devolvió null al detectar el nodo FIN.
            // Finalizar siempre — las aprobaciones de funcionarios ya ocurrieron en pasos previos.
            tramite.setEstado("finalizado");
            tramite.setFecha_fin(LocalDateTime.now());
            tramite.setFecha_ultima_actualizacion(LocalDateTime.now());
            tramiteRepository.save(tramite);
            registrarMovimientoIA(tramiteId, clienteId, "FINALIZAR", "finalizado", null);

            notificacionService.crearNotificacion(tramite.getCliente_id(), tramiteId, tramite.getPolitica_id(),
                    "TRAMITE_FINALIZADO", "✅ Trámite completado",
                    "Tu trámite «" + tramite.getNombre_tramite() + "» ha sido completado exitosamente.",
                    "verified", "success");

            if (tramite.getFuncionario_asignado_id() != null) {
                notificacionService.crearNotificacion(tramite.getFuncionario_asignado_id(), tramiteId, tramite.getPolitica_id(),
                        "TRAMITE_FINALIZADO", "Trámite finalizado",
                        "El trámite «" + tramite.getNombre_tramite() + "» ha sido completado por el cliente.",
                        "verified", "success");
            }

            Map<String, Object> result = new HashMap<>();
            result.put("tramite", tramite);
            result.put("completado", true);
            return result;
        }
    }

    // ============================================================
    // CU-14: FUNCIONARIO GUARDA RESPUESTAS Y AVANZA AL SIGUIENTE PASO
    // ============================================================
    public Map<String, Object> responderComoFuncionario(String tramiteId, String nodoId,
                                                         Map<String, Object> respuestas, String funcionarioId) {
        Tramite tramite = tramiteRepository.findById(tramiteId)
                .orElseThrow(() -> new RuntimeException("Trámite no encontrado"));

        // Validar que el usuario es funcionario/admin
        Usuario funcionario = usuarioRepository.findById(funcionarioId)
                .orElseThrow(() -> new RuntimeException("Funcionario no encontrado"));
        String rol = funcionario.getRol_id();
        if (!"ROL-FUNCIONARIO".equals(rol) && !"ROL-ADMIN".equals(rol) && !"ROL-SUPER".equals(rol)) {
            throw new RuntimeException("No autorizado: se requiere rol de funcionario o administrador");
        }

        // Historial
        if (tramite.getHistorial() == null) tramite.setHistorial(new ArrayList<>());
        Map<String, Object> histEntry = new HashMap<>();
        histEntry.put("nodoId", nodoId);
        histEntry.put("completadoEn", LocalDateTime.now().toString());
        histEntry.put("completadoPor", funcionarioId);
        String nombreFuncionario = funcionario.getNombre_completo() != null && !funcionario.getNombre_completo().isBlank()
                ? funcionario.getNombre_completo() : funcionarioId;
        histEntry.put("completadoPorNombre", nombreFuncionario);
        tramite.getHistorial().add(histEntry);

        // Leer esquema
        Politica politica = politicaRepository.findById(tramite.getPolitica_id()).orElseThrow();
        Map<String, Object> esquema = politica.getEsquema_workflow();
        List<Map<String, Object>> pasos = extraerListaMapas(esquema, "pasos");
        List<Map<String, Object>> relaciones = extraerListaMapas(esquema, "relaciones");

        // Paso actual
        Map<String, Object> pasoActual = pasos.stream()
                .filter(p -> nodoId.equals(p.get("id"))).findFirst().orElse(new HashMap<>());

        // Persistir respuestas
        if (tramite.getRespuestas_por_nodo() == null) tramite.setRespuestas_por_nodo(new HashMap<>());
        tramite.getRespuestas_por_nodo().put(nodoId, respuestas);
        if (tramite.getDatos_formulario() == null) tramite.setDatos_formulario(new HashMap<>());
        tramite.getDatos_formulario().putAll(respuestas);

        // Labels
        Object rawLabels = respuestas.containsKey("__LABELS__") ? respuestas.get("__LABELS__") : respuestas.get("__labels__");
        if (rawLabels instanceof Map<?, ?> lm) {
            if (tramite.getLabels_por_nodo() == null) tramite.setLabels_por_nodo(new HashMap<>());
            Map<String, String> labels = new HashMap<>();
            for (Map.Entry<?, ?> entry : lm.entrySet()) {
                if (entry.getKey() != null && entry.getValue() != null)
                    labels.put(entry.getKey().toString(), entry.getValue().toString());
            }
            tramite.getLabels_por_nodo().put(nodoId, labels);
        }

        // Si el funcionario envía una acción explícita de rechazo u observación, manejarla inmediatamente
        Object accionEspecial = respuestas.containsKey("__ACCION__") ? respuestas.get("__ACCION__") : respuestas.get("__accion__");
        if (accionEspecial != null && "RECHAZAR".equalsIgnoreCase(accionEspecial.toString())) {
            tramite.setEstado("rechazado");
            tramite.setFecha_fin(LocalDateTime.now());
            tramite.setFecha_ultima_actualizacion(LocalDateTime.now());
            tramiteRepository.save(tramite);
            registrarMovimientoIA(tramiteId, funcionarioId, "RECHAZAR", "rechazado", null);
            publicarEstadoTramite(tramite, funcionarioId);

            notificacionService.crearNotificacion(tramite.getCliente_id(), tramiteId, tramite.getPolitica_id(),
                    "TRAMITE_RECHAZADO", "❌ Trámite rechazado",
                    "Tu trámite ha sido rechazado por el funcionario. Revisa las observaciones.",
                    "block", "danger");
            webPushService.sendToUser(tramite.getCliente_id(), "❌ NexusFlow — Trámite rechazado",
                    "Tu trámite «" + tramite.getNombre_tramite() + "» fue rechazado.", "/client");

            Map<String, Object> result = new HashMap<>();
            result.put("tramite", tramite);
            result.put("completado", false);
            result.put("rechazado", true);
            return result;
        }

        // OBSERVAR: marcar estado antes del resolver para que el gateway evalúe "estado_anterior == OBSERVADO"
        final boolean esObservar = accionEspecial != null && "OBSERVAR".equalsIgnoreCase(accionEspecial.toString());
        if (esObservar) {
            tramite.setEstado("observado");
        }

        // Guardar nombre del paso en historial
        if (!tramite.getHistorial().isEmpty()) {
            Map<String, Object> lastEntry = tramite.getHistorial().get(tramite.getHistorial().size() - 1);
            if (nodoId.equals(lastEntry.get("nodoId")) && pasoActual.get("nombre") != null)
                lastEntry.put("nodoNombre", pasoActual.get("nombre"));
        }

        // Resolver siguiente paso usando el grafo del workflow
        String siguientePasoId = resolverSiguientePasoCU12(nodoId, relaciones, tramite);
        siguientePasoId = saltarNodosControl(siguientePasoId, pasos, relaciones, tramite);
        final String siguientePasoIdFinal = siguientePasoId;

        if (siguientePasoIdFinal != null) {
            Map<String, Object> siguientePaso = pasos.stream()
                    .filter(p -> siguientePasoIdFinal.equals(p.get("id"))).findFirst().orElse(null);

            // Determinar si el siguiente paso es de otro funcionario o del cliente
            boolean siguienteEsDeFuncionario = false;
            if (siguientePaso != null) {
                Object unidadObj = siguientePaso.get("departamentoId");
                if (unidadObj == null) unidadObj = siguientePaso.get("unidadId");
                if (unidadObj == null) unidadObj = siguientePaso.get("unidad_id");
                if (unidadObj instanceof String uid && !uid.isBlank() && !uid.equalsIgnoreCase("cliente")) {
                    siguienteEsDeFuncionario = true;
                }
            }

            if (siguienteEsDeFuncionario) {
                // Siguiente paso requiere otro funcionario
                tramite.setEstado("en_revision");
                tramite.setNodo_actual_id(siguientePasoIdFinal);
                String sigFormId = siguientePaso != null ? (String) siguientePaso.get("formularioId") : null;
                tramite.setFormulario_actual_id(sigFormId);
                tramite.setFecha_ultima_actualizacion(LocalDateTime.now());

                // Asignar funcionario de la unidad del siguiente paso
                if (siguientePaso != null) {
                    Object unidadObj = siguientePaso.get("departamentoId");
                    if (unidadObj == null) unidadObj = siguientePaso.get("unidadId");
                    if (unidadObj == null) unidadObj = siguientePaso.get("unidad_id");
                    if (unidadObj instanceof String unidadId && !unidadId.isBlank()) {
                        final String uid = unidadId;
                        List<Usuario> candidatos = usuarioRepository.findAll().stream()
                                .filter(u -> uid.equals(u.getUnidad_id())).toList();
                        if (!candidatos.isEmpty()) {
                            tramite.setFuncionario_asignado_id(candidatos.get(0).getId());
                            notificacionService.crearNotificacion(
                                    candidatos.get(0).getId(), tramiteId, tramite.getPolitica_id(),
                                    "TRAMITE_EN_REVISION", "📋 Trámite listo para revisión",
                                    "El trámite «" + tramite.getNombre_tramite() + "» ha avanzado y requiere tu revisión.",
                                    "task", "primary");
                            webPushService.sendToUser(candidatos.get(0).getId(), "📋 NexusFlow — Nuevo trámite",
                                    "El trámite «" + tramite.getNombre_tramite() + "» ha avanzado y requiere tu revisión.", "/");
                            publicarActualizacionBandeja(uid, tramiteId);
                        }
                    }
                }
                tramiteRepository.save(tramite);
                publicarEstadoTramite(tramite, funcionarioId);
                registrarMovimientoIA(tramiteId, funcionarioId, esObservar ? "OBSERVAR" : "APROBAR", "en_revision", null);

                Map<String, Object> result = new HashMap<>();
                result.put("tramite", tramite);
                result.put("completado", false);
                result.put("enRevision", true);
                result.put("observado", esObservar);
                result.put("siguientePaso", siguientePaso);
                return result;

            } else {
                // Siguiente paso es del cliente (puede ser nodo corrección si viene de OBSERVAR)
                tramite.setEstado("en_proceso");
                tramite.setNodo_actual_id(siguientePasoIdFinal);
                String sigFormId = siguientePaso != null ? (String) siguientePaso.get("formularioId") : null;
                tramite.setFormulario_actual_id(sigFormId);
                tramite.setFecha_ultima_actualizacion(LocalDateTime.now());
                tramiteRepository.save(tramite);
                publicarEstadoTramite(tramite, funcionarioId);
                registrarMovimientoIA(tramiteId, funcionarioId, esObservar ? "OBSERVAR" : "APROBAR", "en_proceso", null);

                if (esObservar) {
                    notificacionService.crearNotificacion(tramite.getCliente_id(), tramiteId, tramite.getPolitica_id(),
                            "TRAMITE_OBSERVADO", "👁️ Trámite con observaciones",
                            "Tu trámite «" + tramite.getNombre_tramite() + "» tiene observaciones. Revisa y completa la información solicitada.",
                            "visibility", "warning");
                    webPushService.sendToUser(tramite.getCliente_id(), "👁️ NexusFlow — Trámite observado",
                            "Tu trámite «" + tramite.getNombre_tramite() + "» requiere correcciones.", "/client");
                } else {
                    notificacionService.crearNotificacion(tramite.getCliente_id(), tramiteId, tramite.getPolitica_id(),
                            "TRAMITE_EN_PROCESO", "📋 Tu trámite requiere acción",
                            "El funcionario ha procesado tu solicitud «" + tramite.getNombre_tramite() + "». Hay un paso pendiente para ti.",
                            "assignment", "primary");
                    webPushService.sendToUser(tramite.getCliente_id(), "📋 NexusFlow — Trámite actualizado",
                            "El trámite «" + tramite.getNombre_tramite() + "» requiere tu acción.", "/client");
                }

                Map<String, Object> result = new HashMap<>();
                result.put("tramite", tramite);
                result.put("completado", false);
                result.put("enProceso", true);
                result.put("observado", esObservar);
                result.put("siguientePaso", siguientePaso);
                return result;
            }

        } else {
            if (esObservar) {
                // OBSERVAR sin nodo corrección definido en el workflow: devolver al cliente genéricamente
                tramite.setFecha_ultima_actualizacion(LocalDateTime.now());
                tramiteRepository.save(tramite);
                publicarEstadoTramite(tramite, funcionarioId);
                registrarMovimientoIA(tramiteId, funcionarioId, "OBSERVAR", "observado", null);

                notificacionService.crearNotificacion(tramite.getCliente_id(), tramiteId, tramite.getPolitica_id(),
                        "TRAMITE_OBSERVADO", "👁️ Trámite con observaciones",
                        "Tu trámite «" + tramite.getNombre_tramite() + "» tiene observaciones del funcionario. Revisa y completa la información.",
                        "visibility", "warning");
                webPushService.sendToUser(tramite.getCliente_id(), "👁️ NexusFlow — Trámite observado",
                        "Tu trámite «" + tramite.getNombre_tramite() + "» requiere correcciones.", "/client");

                Map<String, Object> result = new HashMap<>();
                result.put("tramite", tramite);
                result.put("completado", false);
                result.put("observado", true);
                return result;
            }

            // No hay siguiente paso: finalizar el trámite
            tramite.setEstado("finalizado");
            tramite.setFecha_fin(LocalDateTime.now());
            tramite.setFecha_ultima_actualizacion(LocalDateTime.now());
            tramiteRepository.save(tramite);
            publicarEstadoTramite(tramite, funcionarioId);
            registrarMovimientoIA(tramiteId, funcionarioId, "FINALIZAR", "finalizado", null);

            notificacionService.crearNotificacion(tramite.getCliente_id(), tramiteId, tramite.getPolitica_id(),
                    "TRAMITE_FINALIZADO", "✅ Trámite aprobado y finalizado",
                    "Tu trámite «" + tramite.getNombre_tramite() + "» ha sido completamente procesado y aprobado.",
                    "verified", "success");
            webPushService.sendToUser(tramite.getCliente_id(), "✅ NexusFlow — Trámite finalizado",
                    "Tu trámite «" + tramite.getNombre_tramite() + "» ha sido aprobado y finalizado.", "/client");

            Map<String, Object> result = new HashMap<>();
            result.put("tramite", tramite);
            result.put("completado", true);
            return result;
        }
    }

    // ============================================================
    // CU-12: LISTAR MIS TRÁMITES (autenticado)
    // ============================================================
    public List<Tramite> obtenerMisTramites(String clienteId) {
        return tramiteRepository.findAll().stream()
                .filter(t -> clienteId.equals(t.getCliente_id()))
                .sorted(Comparator.comparing(Tramite::getFecha_inicio, Comparator.reverseOrder()))
                .toList();
    }

    // Resuelve el siguiente paso evaluando las condiciones del esquema (CU-10)
    @SuppressWarnings("unchecked")
    /**
     * Avanza automáticamente sobre nodos de control (GATEWAY, INICIO) hasta llegar
     * a un nodo TAREA o al final del flujo. Esto evita que el cliente vea pasos de decisión.
     */
    private String saltarNodosControl(String pasoId,
            List<Map<String, Object>> pasos,
            List<Map<String, Object>> relaciones,
            Tramite tramite) {
        Set<String> visitados = new HashSet<>();
        String actual = pasoId;
        while (actual != null && !visitados.contains(actual)) {
            visitados.add(actual);
            final String id = actual;
            Map<String, Object> paso = pasos.stream()
                .filter(p -> id.equals(p.get("id"))).findFirst().orElse(null);
            if (paso == null) break;
            String tipo = (String) paso.get("tipoPaso");
            if ("FIN".equals(tipo)) {
                return null; // End of workflow: signal finalization
            } else if ("GATEWAY".equals(tipo) || "INICIO".equals(tipo)) {
                actual = resolverSiguientePasoCU12(actual, relaciones, tramite);
            } else {
                break;
            }
        }
        return actual;
    }

    private String resolverSiguientePasoCU12(String nodoActualId,
                                              List<Map<String, Object>> relaciones,
                                              Tramite tramite) {
        List<Map<String, Object>> salientes = relaciones.stream()
                .filter(r -> nodoActualId.equals(r.get("padreId")))
                .toList();

        if (salientes.isEmpty()) return null;

        // Evaluar condicionales primero
        for (Map<String, Object> rel : salientes) {
            Object condObj = rel.get("condicion");
            if (condObj instanceof Map<?, ?> cm) {
                Map<String, Object> cond = (Map<String, Object>) cm;
                String campoId = stringOrNull(cond.get("campoId"));
                Object valorEsperado = cond.get("valorEsperado");
                String operador = cond.get("operador") != null ? cond.get("operador").toString() : "=";
                Object valorActual = tramite.getDatos_formulario() != null
                        ? tramite.getDatos_formulario().get(campoId) : null;

                if (valorActual != null && valorEsperado != null
                        && evaluarCondicionSimple(valorActual, valorEsperado, operador)) {
                    return stringOrNull(rel.get("destinoId"));
                }
            }
        }

        // Fallback: primera relación de tipo "siguiente" o sin condición
        for (Map<String, Object> rel : salientes) {
            String tipo = stringOrNull(rel.get("tipo"));
            if ("siguiente".equals(tipo) || rel.get("condicion") == null) {
                String dest = stringOrNull(rel.get("destinoId"));
                if (dest != null) return dest;
            }
        }

        return stringOrNull(salientes.get(0).get("destinoId"));
    }

    private boolean evaluarCondicionSimple(Object actual, Object esperado, String operador) {
        try {
            double na = Double.parseDouble(actual.toString().trim());
            double nb = Double.parseDouble(esperado.toString().trim());
            return switch (operador) {
                case ">" -> na > nb;
                case "<" -> na < nb;
                case ">=" -> na >= nb;
                case "<=" -> na <= nb;
                case "!=" -> na != nb;
                default -> na == nb;
            };
        } catch (NumberFormatException e) {
            String sa = actual.toString().trim();
            String sb = esperado.toString().trim();
            return "!=".equals(operador) ? !sa.equalsIgnoreCase(sb) : sa.equalsIgnoreCase(sb);
        }
    }

    // ============================================================
    // CU-15: ELIMINAR EVIDENCIA
    // ============================================================
    public Tramite eliminarEvidencia(String tramiteId, String nombreArchivoFisico) {
        Tramite tramite = tramiteRepository.findById(tramiteId)
                .orElseThrow(() -> new RuntimeException("Trámite no encontrado"));

        try {
            Path rutaArchivo = Paths.get(storageLocation).resolve(nombreArchivoFisico);
            Files.deleteIfExists(rutaArchivo);

            if (tramite.getEvidencias() != null) {
                tramite.getEvidencias().removeIf(e ->
                        e.get("ruta_local").toString().contains(nombreArchivoFisico)
                );
            }

            registrarMovimientoIA(tramiteId, "SISTEMA", "ELIMINACION_EVIDENCIA", tramite.getEstado(),
                    Map.of("archivo_eliminado", nombreArchivoFisico));

            return tramiteRepository.save(tramite);
        } catch (Exception e) {
            throw new RuntimeException("Error al eliminar el archivo: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> documentToMap(Document doc) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : doc.entrySet()) {
            if ("_class".equals(entry.getKey())) continue;
            map.put(entry.getKey(), convertBsonValue(entry.getValue()));
        }
        return map;
    }

    @SuppressWarnings("unchecked")
    private Object convertBsonValue(Object value) {
        if (value instanceof Document d) {
            return documentToMap(d);
        } else if (value instanceof List<?> list) {
            List<Object> result = new ArrayList<>();
            for (Object item : list) {
                result.add(convertBsonValue(item));
            }
            return result;
        }
        return value;
    }

    /**
     * Busca el funcionario designado explícitamente en el carril del esquema workflow
     * para la unidad dada. Retorna null si no hay designación directa.
     */
    @SuppressWarnings("unchecked")
    private String buscarFuncionarioDesignadoEnCarril(String politicaId, String unidadId) {
        if (politicaId == null || unidadId == null) return null;
        return politicaRepository.findById(politicaId)
            .map(p -> {
                Map<String, Object> esquema = p.getEsquema_workflow();
                if (esquema == null) return null;
                List<Map<String, Object>> carriles = (List<Map<String, Object>>) esquema.get("carriles");
                if (carriles == null) return null;
                return carriles.stream()
                    .filter(c -> unidadId.equals(c.get("departamentoId")))
                    .map(c -> (String) c.get("funcionarioAsignadoId"))
                    .filter(id -> id != null && !id.isBlank())
                    .findFirst()
                    .orElse(null);
            })
            .orElse(null);
    }

    /**
     * Resuelve el ID del funcionario a asignar para un nodo TASK.
     * Prioridad: 1) funcionario designado en el carril del esquema, 2) cualquier funcionario de la unidad.
     */
    private String resolverFuncionarioParaNodo(String politicaId, String unidadId) {
        String designado = buscarFuncionarioDesignadoEnCarril(politicaId, unidadId);
        if (designado != null) return designado;
        return usuarioRepository.findAll().stream()
            .filter(u -> unidadId.equals(u.getUnidad_id()))
            .map(u -> u.getId())
            .findFirst()
            .orElse(null);
    }
}