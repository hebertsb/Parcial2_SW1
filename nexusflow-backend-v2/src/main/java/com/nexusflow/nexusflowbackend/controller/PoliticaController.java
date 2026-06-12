package com.nexusflow.nexusflowbackend.controller;

import com.nexusflow.nexusflowbackend.model.Politica;
import com.nexusflow.nexusflowbackend.model.Formulario_Nodo;
import com.nexusflow.nexusflowbackend.service.ExportService;
import org.springframework.context.ApplicationContext;
import org.springframework.beans.factory.NoSuchBeanDefinitionException;
import java.lang.reflect.Method;
import com.nexusflow.nexusflowbackend.service.PoliticaService;
import com.nexusflow.nexusflowbackend.dto.WorkflowDTO;
import jakarta.validation.Valid;
import net.sourceforge.plantuml.SourceStringReader;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/politicas")
@CrossOrigin(origins = "*")
public class PoliticaController {

    @Autowired
    private PoliticaService politicaService;

    @Autowired
    private com.nexusflow.nexusflowbackend.repository.FormularioNodoRepository nodoRepository;

    @Autowired
    private ApplicationContext applicationContext;

    @Autowired
    private ExportService exportService;

    // ============================================================
    // GET: Listar todas las políticas del sistema
    // URL: http://localhost:9090/api/politicas
    // ============================================================
    @GetMapping
    public List<Politica> getAll() {
        return politicaService.listarTodas();
    }

    // ============================================================
    // GET: Obtener una política por ID
    // URL: http://localhost:9090/api/politicas/{id}
    // ============================================================
    @GetMapping("/{id}")
    public Politica getById(@PathVariable String id) {
        return politicaService.obtenerPorId(id);
    }

    // ============================================================
    // GET: Listar políticas por empresa (Multi-tenant)
    // URL: http://localhost:9090/api/politicas/empresa/{empresaId}
    // ============================================================
    @GetMapping("/empresa/{empresaId}")
    public List<Politica> listarPorEmpresa(@PathVariable String empresaId) {
        return politicaService.listarPorEmpresa(empresaId);
    }

    // ============================================================
    // POST: Crear una nueva política base (CU-08)
    // URL: http://localhost:9090/api/politicas
    // ============================================================
    @PostMapping
    public ResponseEntity<?> crear(@Valid @RequestBody Politica politica) {
        try {
            Politica nueva = politicaService.crearPolitica(politica);
            return ResponseEntity.status(201).body(nueva);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(400).body(Map.of(
                "error", "Argumento inválido",
                "message", e.getMessage()
            ));
        }
    }

    // ============================================================
    // PUT: Actualizar los datos base de una política (SLA/estado/nombre)
    // URL: http://localhost:9090/api/politicas/{id}
    // ============================================================
    @PutMapping("/{id}")
    public ResponseEntity<?> actualizar(@PathVariable String id, @RequestBody Politica politica) {
        try {
            Politica actualizada = politicaService.actualizarBase(id, politica);
            return ResponseEntity.ok(actualizada);
        } catch (RuntimeException e) {
            return ResponseEntity.status(404).body(Map.of(
                "error", "No encontrado",
                "message", e.getMessage(),
                "timestamp", LocalDateTime.now()
            ));
        }
    }

    // ============================================================
    // PUT: Actualizar el esquema del workflow (CU-09 y CU-10)
    // URL: http://localhost:9090/api/politicas/{id}/esquema
    // ============================================================
    @PutMapping("/{id}/esquema")
    public ResponseEntity<?> actualizarEsquema(@PathVariable String id, @Valid @RequestBody WorkflowDTO esquema) {
        try {
            Politica actualizada = politicaService.actualizarEsquema(id, esquema);
            return ResponseEntity.ok(actualizada);
        } catch (RuntimeException e) {
            return ResponseEntity.status(404).body(Map.of(
                "error", "No encontrado",
                "message", e.getMessage(),
                "timestamp", LocalDateTime.now()
            ));
        }
    }

    // ============================================================
    // POST: Configurar la estructura de campos de un nodo (CU-11)
    // URL: http://localhost:9090/api/politicas/nodo/configurar
    // ============================================================
    @PostMapping("/nodo/configurar")
    public ResponseEntity<?> configurarNodo(@Valid @RequestBody Formulario_Nodo nodo) {
        try {
            Formulario_Nodo guardado = politicaService.guardarConfiguracionNodo(nodo);
            return ResponseEntity.ok(guardado);
        } catch (RuntimeException e) {
            return ResponseEntity.status(400).body(Map.of(
                "error", "Error al guardar nodo",
                "message", e.getMessage()
            ));
        }
    }

    // ============================================================
    // GET: Ejecutar la verificación de integridad de IDs (Para debug)
    // URL: http://localhost:9090/api/politicas/{id}/verificar
    // ============================================================
    @GetMapping("/{id}/verificar")
    public ResponseEntity<String> verificarConsistencia(@PathVariable String id) {
        politicaService.verificarConsistenciaGrafica(id);
        return ResponseEntity.ok("Verificación ejecutada para: " + id + ". Revisa la consola de IntelliJ.");
    }

    // ============================================================
    // GET: Exportar la política al estándar UML 2.5 (XMI) para Enterprise Architect
    // URL: http://localhost:9090/api/politicas/{id}/exportar-xmi
    // ============================================================
    @GetMapping("/{id}/exportar-xmi")
    public ResponseEntity<byte[]> exportarXMI(@PathVariable String id) {
        try {
            Politica politica = politicaService.obtenerPorId(id);
            List<Formulario_Nodo> nodos = obtenerNodosSincronizados(id);
            List<Map<String, Object>> relaciones = extraerRelaciones(politica);
            String contenidoXmi = exportService.generarXMI(politica, nodos, relaciones);
            byte[] data = contenidoXmi.getBytes(StandardCharsets.UTF_8);
            String nombreArchivo = politica.getNombre().replace(" ", "_") + "_UML25.xmi";
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + nombreArchivo + "\"")
                    .contentType(MediaType.APPLICATION_XML)
                    .body(data);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(("Error al generar XMI: " + e.getMessage()).getBytes());
        }
    }

    // ============================================================
    // GET: Exportar el diagrama a imagen PNG usando PlantUML
    // URL: http://localhost:9090/api/politicas/{id}/exportar-png
    // ============================================================
    @SuppressWarnings("deprecation")
    @GetMapping("/{id}/exportar-png")
    public ResponseEntity<byte[]> exportarPNG(@PathVariable String id) {
        try {
            Politica p = politicaService.obtenerPorId(id);
            List<Formulario_Nodo> nodos = obtenerNodosSincronizados(id);
            List<Map<String, Object>> relaciones = extraerRelaciones(p);

            if (nodos.isEmpty()) {
                String errorPlantUml = "@startuml\ntitle " + p.getNombre() + "\nstart\n:Sin nodos;\nstop\n@enduml";
                SourceStringReader reader = new SourceStringReader(errorPlantUml);
                ByteArrayOutputStream os = new ByteArrayOutputStream();
                reader.generateImage(os);
                return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(os.toByteArray());
            }

            byte[] imagen = exportService.exportarAPNG(p, nodos, relaciones);
            if (imagen.length == 0) return ResponseEntity.status(500).body(null);

            return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(imagen);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(("Error: " + e.getMessage()).getBytes());
        }
    }

    // ============================================================
    // MÉTODO PRIVADO: Extraer relaciones del esquema_workflow
    // ============================================================
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> extraerRelaciones(Politica politica) {
        List<Map<String, Object>> result = new ArrayList<>();
        Map<String, Object> esquema = politica.getEsquema_workflow();
        if (esquema == null) return result;
        Object raw = esquema.get("relaciones");
        if (!(raw instanceof List<?>)) return result;
        for (Object obj : (List<?>) raw) {
            if (obj instanceof Map<?, ?> m) result.add((Map<String, Object>) m);
        }
        return result;
    }

    // ============================================================
    // MÉTODO PRIVADO: Extraer nodos del esquema_workflow
    // ============================================================
    /**
     * Extrae los nodos del esquema_workflow y los convierte a objetos Formulario_Nodo.
     * Maneja correctamente los diferentes tipos: TASK, GATEWAY, NODO_INICIO, NODO_FIN
     *
     * @param id ID de la política
     * @return Lista de nodos convertidos
     */
    private List<Formulario_Nodo> obtenerNodosSincronizados(String id) {
        Politica politica = politicaService.obtenerPorId(id);
        Map<String, Object> esquema = politica.getEsquema_workflow();

        System.out.println("=== DEBUG: Esquema Workflow ===");
        System.out.println(esquema);

        List<Formulario_Nodo> nodosResult = new ArrayList<>();

        if (esquema != null && esquema.get("pasos") != null) {
            List<?> nodosRaw = (List<?>) esquema.get("pasos");
            System.out.println("Nodos raw: " + nodosRaw);

            for (Object obj : nodosRaw) {
                Formulario_Nodo nodo = null;

                if (obj instanceof Formulario_Nodo) {
                    nodo = (Formulario_Nodo) obj;
                    System.out.println("Nodo es Formulario_Nodo: " + nodo.getNombre_nodo());
                }
                else if (obj instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> nodoMap = (Map<String, Object>) obj;
                    // Leer tipo desde 'tipo' (frontend) o 'tipo_nodo' (backend)
                    String tipo = (String) nodoMap.getOrDefault("tipo", nodoMap.get("tipo_nodo"));

                    System.out.println("Nodo es Map con tipo: " + tipo);

                    // Crear nodo manualmente para evitar problemas de tipos
                    nodo = new Formulario_Nodo();
                    nodo.setId((String) nodoMap.get("id"));
                    nodo.setId_visual((String) nodoMap.get("id_visual"));
                    // Leer nombre desde 'nombre' (frontend) o 'nombre_nodo' (backend)
                    String nombreNodo = (String) nodoMap.getOrDefault("nombre", nodoMap.get("nombre_nodo"));
                    nodo.setNombre_nodo(nombreNodo != null ? nombreNodo : "Nodo");
                    // Mapear tipoPaso (frontend) → tipo_nodo; fallback a tipo o tipo_nodo
                    String tipoPaso = (String) nodoMap.get("tipoPaso");
                    if (tipoPaso != null && !tipoPaso.isBlank()) {
                        tipo = tipoPaso; // INICIO, FIN, TAREA, GATEWAY del frontend
                    }
                    // Inferir por esUltimo si no hay tipo
                    if ((tipo == null || tipo.isBlank()) && Boolean.TRUE.equals(nodoMap.get("esUltimo"))) {
                        tipo = "FIN";
                    }
                    nodo.setTipo_nodo(tipo);
                    // Mapear departamentoId (frontend) → unidad_id; fallback a unidad_id
                    String unidad = (String) nodoMap.getOrDefault("departamentoId",
                                    nodoMap.getOrDefault("unidad_id", null));
                    nodo.setUnidad_id(unidad != null ? unidad : "Proceso");

                    // Campos adicionales
                    if (nodoMap.containsKey("id_nodo")) {
                        nodo.setId_nodo((String) nodoMap.get("id_nodo"));
                    }
                    if (nodoMap.containsKey("posicion_x")) {
                        Object x = nodoMap.get("posicion_x");
                        if (x instanceof Integer) {
                            nodo.setPosicion_x((Integer) x);
                        }
                    }
                    if (nodoMap.containsKey("posicion_y")) {
                        Object y = nodoMap.get("posicion_y");
                        if (y instanceof Integer) {
                            nodo.setPosicion_y((Integer) y);
                        }
                    }

                    System.out.println("  -> Nodo creado: " + nodo.getNombre_nodo());
                }

                if (nodo != null) {
                    if (nodo.getId_visual() == null || nodo.getId_visual().isEmpty()) {
                        nodo.setId_visual("N_" + (nodo.getId() != null ? nodo.getId() : UUID.randomUUID().toString()));
                    }
                    nodosResult.add(nodo);
                }
            }
        } else {
            System.out.println("Usando fallback: buscar en repositorio");
            final String filterId = id;
            nodosResult = nodoRepository.findAll().stream()
                    .filter(n -> n.getPolitica_id() != null && n.getPolitica_id().equals(filterId))
                    .collect(Collectors.toList());
        }

        System.out.println("=== Nodos resultantes (" + nodosResult.size() + ") ===");
        for (Formulario_Nodo n : nodosResult) {
            System.out.println("  - ID: " + n.getId() +
                    ", Tipo: " + n.getTipo_nodo() +
                    ", Nombre: " + n.getNombre_nodo() +
                    ", Unidad: " + n.getUnidad_id() +
                    ", ID Visual: " + n.getId_visual());
        }

        return nodosResult;
    }

    // ============================================================
    // GET: Diagnóstico para ver la estructura exacta de los nodos en MongoDB
    // URL: http://localhost:9090/api/politicas/{id}/diagnostico
    // ============================================================
    @GetMapping("/{id}/diagnostico")
    public ResponseEntity<?> diagnostico(@PathVariable String id) {
        Politica politica = politicaService.obtenerPorId(id);
        Map<String, Object> esquema = politica.getEsquema_workflow();

        Map<String, Object> resultado = new LinkedHashMap<>();
        resultado.put("politica_id", id);
        resultado.put("politica_nombre", politica.getNombre());

        if (esquema != null) {
            resultado.put("esquema_keys", esquema.keySet());

            if (esquema.containsKey("nodos")) {
                List<?> nodosRaw = (List<?>) esquema.get("nodos");
                resultado.put("cantidad_nodos", nodosRaw.size());

                List<Map<String, Object>> nodosDetalle = new ArrayList<>();
                for (Object obj : nodosRaw) {
                    Map<String, Object> detalle = new LinkedHashMap<>();
                    detalle.put("clase", obj.getClass().getName());

                    if (obj instanceof Formulario_Nodo) {
                        Formulario_Nodo n = (Formulario_Nodo) obj;
                        detalle.put("id", n.getId());
                        detalle.put("nombre_nodo", n.getNombre_nodo());
                        detalle.put("tipo_nodo", n.getTipo_nodo());
                        detalle.put("unidad_id", n.getUnidad_id());
                        detalle.put("id_visual", n.getId_visual());
                    } else if (obj instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> m = (Map<String, Object>) obj;
                        detalle.put("id", m.get("id"));
                        detalle.put("nombre", m.get("nombre"));
                        detalle.put("tipo", m.get("tipo"));
                        detalle.put("unidad_id", m.get("unidad_id"));
                        detalle.put("id_visual", m.get("id_visual"));
                    } else {
                        detalle.put("toString", obj.toString());
                    }
                    nodosDetalle.add(detalle);
                }
                resultado.put("nodos", nodosDetalle);
            }

            if (esquema.containsKey("enlaces")) {
                resultado.put("enlaces", esquema.get("enlaces"));
            }
        }

        return ResponseEntity.ok(resultado);
    }
}