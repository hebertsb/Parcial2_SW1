package com.nexusflow.nexusflowbackend.service;

import com.nexusflow.nexusflowbackend.model.Bitacora;
import com.nexusflow.nexusflowbackend.model.Formulario_Nodo;
import com.nexusflow.nexusflowbackend.model.Tramite;
import com.nexusflow.nexusflowbackend.model.Usuario;
import com.nexusflow.nexusflowbackend.repository.BitacoraRepository;
import com.nexusflow.nexusflowbackend.repository.FormularioNodoRepository;
import com.nexusflow.nexusflowbackend.repository.TramiteRepository;
import com.nexusflow.nexusflowbackend.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AnalyticsService {

    @Autowired
    private TramiteRepository tramiteRepository;

    @Autowired
    private NotificacionService notificacionService;

    @Autowired
    private FormularioNodoRepository nodoRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private BitacoraRepository bitacoraRepository;

    // ============================================================
    // MÉTODO 1: DETECTAR CUELLOS DE BOTELLA POR NODO
    // ============================================================
    /**
     * Detecta qué nodos (departamentos) están tardando demasiado en procesar trámites.
     * Un cuello de botella se detecta cuando el tiempo promedio de espera en un nodo
     * supera las 48 horas.
     *
     * @param empresaId ID de la empresa (filtro opcional)
     * @return Mapa con la lista de cuellos de botella y estadísticas
     */
    public Map<String, Object> detectarCuellosBotella(String empresaId) {
        // 1. Obtener todos los trámites que están en progreso
        List<Tramite> tramites = tramiteRepository.findAll().stream()
                .filter(t -> "en_progreso".equals(t.getEstado()))
                .collect(Collectors.toList());

        if (tramites.isEmpty()) {
            return Map.of(
                    "cuellosBotella", new ArrayList<>(),
                    "totalTramitesActivos", 0,
                    "mensaje", "No hay trámites activos en el sistema"
            );
        }

        // 2. Contar cuántos trámites hay por cada nodo
        Map<String, Long> tramitesPorNodo = tramites.stream()
                .collect(Collectors.groupingBy(Tramite::getNodo_actual_id, Collectors.counting()));

        // 3. Calcular tiempos promedio por nodo
        Map<String, Double> tiemposPromedio = new HashMap<>();
        Map<String, Double> tiemposMaximos = new HashMap<>();
        Map<String, Double> tiemposMinimos = new HashMap<>();

        for (Tramite t : tramites) {
            double horas = Duration.between(t.getFecha_inicio(), LocalDateTime.now()).toHours();
            String nodoId = t.getNodo_actual_id();

            tiemposPromedio.merge(nodoId, horas, (a, b) -> (a + b) / 2);
            tiemposMaximos.merge(nodoId, horas, Math::max);
            tiemposMinimos.merge(nodoId, horas, Math::min);
        }

        // 4. Identificar cuellos de botella
        List<Map<String, Object>> bottlenecks = new ArrayList<>();
        for (Map.Entry<String, Double> entry : tiemposPromedio.entrySet()) {
            String nodoId = entry.getKey();
            double promedio = entry.getValue();
            double maximo = tiemposMaximos.getOrDefault(nodoId, 0.0);
            double minimo = tiemposMinimos.getOrDefault(nodoId, 0.0);
            long cantidad = tramitesPorNodo.getOrDefault(nodoId, 0L);

            String severidad;
            if (promedio > 72) {
                severidad = "CRITICO";
                notificarCuelloBotella(nodoId, promedio, cantidad, severidad);
            } else if (promedio > 48) {
                severidad = "ALTO";
                notificarCuelloBotella(nodoId, promedio, cantidad, severidad);
            } else if (promedio > 24) {
                severidad = "MEDIO";
            } else {
                severidad = "BAJO";
            }

            if (promedio > 24) {
                Map<String, Object> b = new HashMap<>();
                b.put("nodoId", nodoId);
                b.put("tiempoPromedioHoras", Math.round(promedio * 10) / 10.0);
                b.put("tiempoMaximoHoras", Math.round(maximo * 10) / 10.0);
                b.put("tiempoMinimoHoras", Math.round(minimo * 10) / 10.0);
                b.put("cantidadTramites", cantidad);
                b.put("severidad", severidad);
                bottlenecks.add(b);
            }
        }

        bottlenecks.sort((a, b) -> {
            String sevA = (String) a.get("severidad");
            String sevB = (String) b.get("severidad");
            Map<String, Integer> orden = Map.of("CRITICO", 1, "ALTO", 2, "MEDIO", 3);
            return orden.get(sevA) - orden.get(sevB);
        });

        return Map.of(
                "cuellosBotella", bottlenecks,
                "totalTramitesActivos", tramites.size(),
                "fechaAnalisis", LocalDateTime.now()
        );
    }

    // ============================================================
    // MÉTODO 1.2: DETECTAR FUNCIONARIOS SATURADOS
    // ============================================================
    /**
     * Detecta qué funcionarios tienen demasiados trámites asignados.
     * Un funcionario está saturado cuando tiene más de 5 trámites en progreso.
     *
     * @param empresaId ID de la empresa
     * @return Lista de funcionarios saturados
     */
    public Map<String, Object> detectarFuncionariosSaturados(String empresaId) {
        List<Tramite> tramites = tramiteRepository.findAll().stream()
                .filter(t -> "en_progreso".equals(t.getEstado()))
                .filter(t -> t.getFuncionario_asignado_id() != null)
                .collect(Collectors.toList());

        // Agrupar por funcionario asignado
        Map<String, List<Tramite>> tramitesPorFuncionario = tramites.stream()
                .collect(Collectors.groupingBy(Tramite::getFuncionario_asignado_id));

        List<Map<String, Object>> funcionariosSaturados = new ArrayList<>();

        for (Map.Entry<String, List<Tramite>> entry : tramitesPorFuncionario.entrySet()) {
            String funcionarioId = entry.getKey();
            List<Tramite> tramitesFunc = entry.getValue();
            int cantidad = tramitesFunc.size();

            // Un funcionario está saturado si tiene más de 5 trámites
            if (cantidad > 5) {
                Optional<Usuario> funcionario = usuarioRepository.findById(funcionarioId);

                Map<String, Object> saturado = new HashMap<>();
                saturado.put("funcionarioId", funcionarioId);
                saturado.put("funcionarioNombre", funcionario.map(Usuario::getNombre_completo).orElse("Desconocido"));
                saturado.put("cantidadTramites", cantidad);
                saturado.put("nodos", tramitesFunc.stream()
                        .map(Tramite::getNodo_actual_id)
                        .distinct()
                        .collect(Collectors.toList()));

                // Determinar severidad
                if (cantidad > 10) {
                    saturado.put("severidad", "CRITICO");
                } else if (cantidad > 7) {
                    saturado.put("severidad", "ALTO");
                } else {
                    saturado.put("severidad", "MEDIO");
                }

                funcionariosSaturados.add(saturado);
            }
        }

        // Ordenar por cantidad de trámites (mayor primero)
        funcionariosSaturados.sort((a, b) -> {
            int cantA = (int) a.get("cantidadTramites");
            int cantB = (int) b.get("cantidadTramites");
            return Integer.compare(cantB, cantA);
        });

        return Map.of(
                "funcionariosSaturados", funcionariosSaturados,
                "totalFuncionariosSaturados", funcionariosSaturados.size(),
                "fechaAnalisis", LocalDateTime.now()
        );
    }

    // ============================================================
    // MÉTODO AUXILIAR: Notificar cuellos de botella
    // ============================================================
    private void notificarCuelloBotella(String nodoId, double horas, long cantidad, String severidad) {
        try {
            String titulo = severidad.equals("CRITICO")
                    ? "🚨 CUELLO DE BOTELLA CRÍTICO"
                    : "⚠️ Cuello de botella detectado";

            String mensaje = "El nodo " + nodoId + " tiene " + cantidad + " trámite(s) con "
                    + Math.round(horas) + " horas de espera. (" + severidad + ")";

            System.out.println("📊 [ANALYTICS] " + titulo + ": " + mensaje);
        } catch (Exception e) {
            System.out.println("Error al notificar cuello de botella: " + e.getMessage());
        }
    }

    // ============================================================
    // MÉTODO 2: SUGERIR MEJORAS
    // ============================================================
    /**
     * Genera recomendaciones automáticas para eliminar los cuellos de botella.
     *
     * @param empresaId ID de la empresa
     * @return Lista de sugerencias personalizadas
     */
    public Map<String, Object> sugerirMejoras(String empresaId) {
        Map<String, Object> resultado = detectarCuellosBotella(empresaId);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> bottlenecks = (List<Map<String, Object>>) resultado.get("cuellosBotella");

        List<String> recomendaciones = new ArrayList<>();
        List<String> accionesAutomaticas = new ArrayList<>();

        if (bottlenecks.isEmpty()) {
            recomendaciones.add("✅ No se detectaron cuellos de botella. El sistema funciona correctamente.");
            recomendaciones.add("📊 Continúa monitoreando los tiempos de respuesta.");
        } else {
            recomendaciones.add("📋 Se detectaron " + bottlenecks.size() + " cuello(s) de botella en el sistema.");

            for (Map<String, Object> bottleneck : bottlenecks) {
                String nodoId = (String) bottleneck.get("nodoId");
                double horas = (double) bottleneck.get("tiempoPromedioHoras");
                long cantidad = (long) bottleneck.get("cantidadTramites");
                String severidad = (String) bottleneck.get("severidad");

                switch (severidad) {
                    case "CRITICO":
                        recomendaciones.add("🚨 CRÍTICO - Nodo: " + nodoId);
                        recomendaciones.add("   ▶ Tiempo promedio: " + horas + " horas");
                        recomendaciones.add("   ▶ Trámites atascados: " + cantidad);
                        recomendaciones.add("   ▶ RECOMENDACIÓN: Contratar personal adicional URGENTE o reasignar tareas.");
                        recomendaciones.add("   ▶ ACCIÓN SUGERIDA: Revisar el flujo del proceso para eliminar pasos innecesarios.");
                        accionesAutomaticas.add("REASIGNAR_TAREAS:" + nodoId);
                        break;
                    case "ALTO":
                        recomendaciones.add("⚠️ ALTO - Nodo: " + nodoId);
                        recomendaciones.add("   ▶ Tiempo promedio: " + horas + " horas");
                        recomendaciones.add("   ▶ Trámites atascados: " + cantidad);
                        recomendaciones.add("   ▶ RECOMENDACIÓN: Capacitar al personal o redistribuir la carga laboral.");
                        recomendaciones.add("   ▶ ACCIÓN SUGERIDA: Establecer alertas cuando se superen las 48 horas.");
                        accionesAutomaticas.add("ALERTA_ADMIN:" + nodoId);
                        break;
                    case "MEDIO":
                        recomendaciones.add("📌 MEDIO - Nodo: " + nodoId);
                        recomendaciones.add("   ▶ Tiempo promedio: " + horas + " horas");
                        recomendaciones.add("   ▶ RECOMENDACIÓN: Monitorear de cerca este nodo.");
                        recomendaciones.add("   ▶ ACCIÓN SUGERIDA: Revisar si el proceso puede ser automatizado.");
                        break;
                    default:
                        break;
                }
            }
        }

        recomendaciones.add("");
        recomendaciones.add("💡 RECOMENDACIONES GENERALES:");
        recomendaciones.add("   1. Automatizar tareas repetitivas usando reglas de decisión (GATEWAY)");
        recomendaciones.add("   2. Establecer SLAs (tiempos máximos) por cada nodo");
        recomendaciones.add("   3. Capacitar al personal en el uso del sistema");
        recomendaciones.add("   4. Revisar periódicamente los reportes de analítica");

        Map<String, Object> sugerencias = new HashMap<>();
        sugerencias.put("recomendaciones", recomendaciones);
        sugerencias.put("accionesAutomaticas", accionesAutomaticas);
        sugerencias.put("fechaGeneracion", LocalDateTime.now());
        sugerencias.put("totalCuellosBotella", bottlenecks.size());

        return sugerencias;
    }

    // ============================================================
    // MÉTODO 3: REASIGNAR TAREAS AUTOMÁTICAMENTE (VERSIÓN REAL)
    // ============================================================
    /**
     * REASIGNACIÓN REAL: Cambia el funcionario responsable del trámite.
     * Este método SÍ modifica el campo 'funcionario_asignado_id' en el trámite.
     *
     * @param nodoId ID del nodo con cuello de botella
     * @param umbralTareas Número máximo de tareas antes de reasignar
     * @param funcionarioActualId ID del funcionario actualmente saturado
     * @return Resultado de la operación con los trámites reasignados
     */
    public Map<String, Object> reasignarTareasAutomaticamente(String nodoId, long umbralTareas, String funcionarioActualId) {
        Map<String, Object> resultado = new HashMap<>();
        List<Map<String, String>> tareasReasignadas = new ArrayList<>();

        // 1. Buscar trámites del funcionario actual en ese nodo
        List<Tramite> tramitesAtascados = tramiteRepository.findAll().stream()
                .filter(t -> nodoId.equals(t.getNodo_actual_id()))
                .filter(t -> "en_progreso".equals(t.getEstado()))
                .filter(t -> funcionarioActualId.equals(t.getFuncionario_asignado_id()))
                .collect(Collectors.toList());

        if (tramitesAtascados.size() <= umbralTareas) {
            resultado.put("mensaje", "No hay suficientes trámites para reasignar (umbral: " + umbralTareas + ")");
            resultado.put("tareasReasignadas", tareasReasignadas);
            return resultado;
        }

        // 2. Buscar otros funcionarios de la misma unidad
        Formulario_Nodo nodo = nodoRepository.findById(nodoId).orElse(null);
        if (nodo == null || nodo.getUnidad_id() == null) {
            resultado.put("mensaje", "Nodo o unidad no encontrada");
            return resultado;
        }

        List<Usuario> otrosFuncionarios = usuarioRepository.findAll().stream()
                .filter(u -> nodo.getUnidad_id().equals(u.getUnidad_id()))
                .filter(u -> !u.getId().equals(funcionarioActualId))
                .collect(Collectors.toList());

        if (otrosFuncionarios.isEmpty()) {
            resultado.put("mensaje", "No hay otros funcionarios disponibles en esta unidad");
            return resultado;
        }

        // 3. REASIGNACIÓN REAL: Cambiar el funcionario_asignado_id
        int index = 0;
        int reasignados = 0;

        for (Tramite t : tramitesAtascados) {
            Usuario nuevoFuncionario = otrosFuncionarios.get(index % otrosFuncionarios.size());

            // 🔄 CAMBIO REAL: Asignar el trámite al nuevo funcionario
            t.setFuncionario_asignado_id(nuevoFuncionario.getId());
            tramiteRepository.save(t);

            // Registrar en el historial del trámite
            Map<String, Object> historialEntry = new HashMap<>();
            historialEntry.put("accion", "REASIGNACION_AUTOMATICA");
            historialEntry.put("fecha", LocalDateTime.now());
            historialEntry.put("funcionario_anterior", funcionarioActualId);
            historialEntry.put("funcionario_nuevo", nuevoFuncionario.getId());
            historialEntry.put("motivo", "Alta carga laboral en nodo " + nodoId);

            if (t.getHistorial() == null) {
                t.setHistorial(new ArrayList<>());
            }
            t.getHistorial().add(historialEntry);
            tramiteRepository.save(t);

            // Guardar información para la respuesta
            Map<String, String> tareaInfo = new HashMap<>();
            tareaInfo.put("tramiteId", t.getId());
            tareaInfo.put("nuevoFuncionario", nuevoFuncionario.getNombre_completo());
            tareaInfo.put("nuevoFuncionarioId", nuevoFuncionario.getId());
            tareasReasignadas.add(tareaInfo);

            // Notificar al nuevo funcionario
            notificacionService.crearNotificacion(
                    nuevoFuncionario.getId(),
                    t.getId(),
                    t.getPolitica_id(),
                    "REASIGNACION_AUTOMATICA",
                    "🔄 Tarea reasignada automáticamente",
                    "Se te ha reasignado esta tarea por alta carga laboral en " + nodoId,
                    "refresh",
                    "warning"
            );

            // Notificar al funcionario anterior
            notificacionService.crearNotificacion(
                    funcionarioActualId,
                    t.getId(),
                    t.getPolitica_id(),
                    "TAREA_REASIGNADA",
                    "📤 Tarea reasignada",
                    "La tarea ha sido reasignada a " + nuevoFuncionario.getNombre_completo() + " por alta carga laboral",
                    "logout",
                    "info"
            );

            reasignados++;
            index++;
        }

        resultado.put("mensaje", "✅ Se reasignaron " + reasignados + " tareas correctamente");
        resultado.put("tareasReasignadas", tareasReasignadas);
        resultado.put("nodoId", nodoId);
        resultado.put("funcionarioOriginal", funcionarioActualId);
        resultado.put("fechaReasignacion", LocalDateTime.now());

        System.out.println("📊 [ANALYTICS] Se REASIGNARON " + reasignados + " tareas del nodo " + nodoId);

        return resultado;
    }

    // ============================================================
    // MÉTODO 4: ESCALAR TRÁMITES VENCIDOS
    // ============================================================
    /**
     * Aumenta la prioridad de trámites que pasaron su fecha límite.
     *
     * @param adminId ID del administrador para notificaciones
     */
    public void escalarTramitesVencidos(String adminId) {
        List<Tramite> tramites = tramiteRepository.findAll();
        LocalDateTime ahora = LocalDateTime.now();
        int escalados = 0;

        for (Tramite t : tramites) {
            if (t.getFecha_limite() != null && ahora.isAfter(t.getFecha_limite())) {
                if ("Media".equals(t.getPrioridad())) {
                    t.setPrioridad("Alta");
                    t.setSemaforizacion("Rojo");
                    tramiteRepository.save(t);
                    escalados++;

                    // Registrar en Bitácora para entrenamiento LSTM
                    Bitacora bita = new Bitacora();
                    bita.setTramite_id(t.getId());
                    bita.setUsuario_id(adminId != null ? adminId : "SISTEMA_ANALYTICS");
                    bita.setAccion("ESCALAR");
                    bita.setEstado("escalado");
                    bita.setFecha_hora(LocalDateTime.now());
                    bita.setDetalle_ia(Map.of(
                            "motivo", "Excedió fecha límite SLA",
                            "prioridad_nueva", "Alta",
                            "origen", "automatico"
                    ));
                    bitacoraRepository.save(bita);

                    String nombreTramite = t.getNombre_tramite() != null && !t.getNombre_tramite().isBlank()
                            ? t.getNombre_tramite() : t.getId();
                    notificacionService.crearNotificacion(
                            adminId,
                            t.getId(),
                            t.getPolitica_id(),
                            "ESCALAMIENTO_AUTOMATICO",
                            "⚠️ Trámite escalado a ALTA prioridad",
                            "«" + nombreTramite + "» excedió su fecha límite y fue escalado automáticamente",
                            "warning",
                            "danger"
                    );
                }
            }
        }

        if (escalados > 0) {
            System.out.println("📊 [ANALYTICS] Se escalaron " + escalados + " trámites por vencimiento");
        }
    }

    // ============================================================
    // MÉTODO 5: OBTENER ALERTAS ACTIVAS
    // ============================================================
    /**
     * Recolecta todas las alertas activas del sistema.
     *
     * @param empresaId ID de la empresa
     * @return Lista de alertas ordenadas por severidad
     */
    public Map<String, Object> obtenerAlertasActivas(String empresaId) {
        List<Map<String, Object>> alertas = new ArrayList<>();

        // 1. Agregar cuellos de botella como alertas
        Map<String, Object> cuellos = detectarCuellosBotella(empresaId);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> bottlenecks = (List<Map<String, Object>>) cuellos.get("cuellosBotella");

        for (Map<String, Object> b : bottlenecks) {
            Map<String, Object> alerta = new HashMap<>();
            alerta.put("tipo", "CUELLO_BOTELLA");
            alerta.put("severidad", b.get("severidad"));
            alerta.put("nodoId", b.get("nodoId"));
            alerta.put("mensaje", "Nodo " + b.get("nodoId") + " con " + b.get("tiempoPromedioHoras") + " horas de retraso");
            alerta.put("accionSugerida", b.get("severidad").equals("CRITICO") ? "Reasignar personal URGENTE" : "Revisar flujo del proceso");
            alerta.put("fecha", LocalDateTime.now());
            alertas.add(alerta);
        }

        // 2. Agregar funcionarios saturados como alertas
        Map<String, Object> funcionariosSaturados = detectarFuncionariosSaturados(empresaId);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> saturados = (List<Map<String, Object>>) funcionariosSaturados.get("funcionariosSaturados");

        for (Map<String, Object> f : saturados) {
            Map<String, Object> alerta = new HashMap<>();
            alerta.put("tipo", "FUNCIONARIO_SATURADO");
            alerta.put("severidad", f.get("severidad"));
            alerta.put("funcionarioId", f.get("funcionarioId"));
            alerta.put("funcionarioNombre", f.get("funcionarioNombre"));
            alerta.put("mensaje", "Funcionario " + f.get("funcionarioNombre") + " tiene " + f.get("cantidadTramites") + " trámites asignados");
            alerta.put("accionSugerida", "Reasignar tareas a otros compañeros");
            alerta.put("fecha", LocalDateTime.now());
            alertas.add(alerta);
        }

        // 3. Agregar trámites por vencer (menos de 24 horas)
        List<Tramite> tramites = tramiteRepository.findAll();
        for (Tramite t : tramites) {
            if (t.getFecha_limite() != null && "en_progreso".equals(t.getEstado())) {
                long horasRestantes = Duration.between(LocalDateTime.now(), t.getFecha_limite()).toHours();
                if (horasRestantes <= 24 && horasRestantes > 0) {
                    Map<String, Object> alerta = new HashMap<>();
                    alerta.put("tipo", "VENCIMIENTO_PROXIMO");
                    alerta.put("severidad", horasRestantes <= 12 ? "CRITICO" : "MEDIO");
                    alerta.put("tramiteId", t.getId());
                    alerta.put("mensaje", "Trámite " + t.getId() + " vence en " + horasRestantes + " horas");
                    alerta.put("fecha", LocalDateTime.now());
                    alertas.add(alerta);
                }
            }
        }

        // 4. Ordenar por severidad
        alertas.sort((a, b) -> {
            String sevA = (String) a.get("severidad");
            String sevB = (String) b.get("severidad");
            Map<String, Integer> orden = Map.of("CRITICO", 1, "ALTO", 2, "MEDIO", 3, "BAJO", 4);
            return orden.getOrDefault(sevA, 5) - orden.getOrDefault(sevB, 5);
        });

        return Map.of(
                "alertas", alertas,
                "totalAlertas", alertas.size(),
                "fechaGeneracion", LocalDateTime.now()
        );
    }
}