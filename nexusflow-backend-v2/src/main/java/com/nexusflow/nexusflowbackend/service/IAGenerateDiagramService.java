package com.nexusflow.nexusflowbackend.service;

import com.nexusflow.nexusflowbackend.dto.WorkflowDTO;
import com.nexusflow.nexusflowbackend.model.Formulario_Nodo;
import com.nexusflow.nexusflowbackend.model.Politica;
import com.nexusflow.nexusflowbackend.repository.FormularioNodoRepository;
import com.nexusflow.nexusflowbackend.repository.PoliticaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class IAGenerateDiagramService {

    @Autowired
    private PythonAIService pythonAIService;

    @Autowired
    private PoliticaRepository politicaRepository;

    @Autowired
    private PoliticaService politicaService;

    @Autowired
    private FormularioNodoRepository formularioNodoRepository;

    public Map<String, Object> generarDiagramaDesdeTexto(String descripcion, String empresaId) {
        return pythonAIService.generarDiagrama(descripcion, empresaId);
    }

    /**
     * Convierte el tipo de nodo de FastAPI al tipo que usa el Angular.
     * FastAPI: NODO_INICIO | TASK | GATEWAY | NODO_FIN
     * Angular: INICIO     | TAREA| GATEWAY  | FIN
     */
    private String convertirTipo(String tipoIA) {
        return switch (tipoIA) {
            case "NODO_INICIO" -> "INICIO";
            case "TASK"        -> "TAREA";
            case "NODO_FIN"    -> "FIN";
            default            -> tipoIA; // GATEWAY queda igual
        };
    }

    /**
     * Convierte el tipo de campo de FastAPI al tipo que usa Angular CampoFormulario.
     * FastAPI: texto | textarea | numero | fecha | archivo | select | checkbox
     * Angular: texto | texto_largo | numero | fecha | archivo | lista | si_no
     */
    private String convertirTipoCampo(String tipoIA) {
        return switch (tipoIA) {
            case "textarea" -> "texto_largo";
            case "select"   -> "lista";
            case "checkbox" -> "si_no";
            default         -> tipoIA; // texto, numero, fecha, archivo quedan igual
        };
    }

    /**
     * Genera diagrama con IA y lo guarda en una POLÍTICA EXISTENTE.
     * - Convierte tipos al formato Angular (INICIO/TAREA/FIN/GATEWAY)
     * - Crea Formulario_Nodo con campos en MongoDB para cada TAREA
     * - Guarda el esquema completo (pasos/relaciones/carriles) en la política
     */
    @SuppressWarnings("unchecked")
    public Politica generarYActualizarPolitica(String politicaId, String descripcion, String usuarioId) {
        Politica politica = politicaRepository.findById(politicaId)
                .orElseThrow(() -> new RuntimeException("Política no encontrada: " + politicaId));

        // 1. Eliminar nodos previos de esta política (para reemplazar con los nuevos)
        List<Formulario_Nodo> nodosAntiguos = formularioNodoRepository.buscarPorPolitica(politicaId);
        formularioNodoRepository.deleteAll(nodosAntiguos);

        // 2. Generar diagrama con IA (FastAPI → Llama 3.3)
        Map<String, Object> diagrama = generarDiagramaDesdeTexto(descripcion, politica.getEmpresa_id());
        List<Map<String, Object>> nodosIA   = (List<Map<String, Object>>) diagrama.getOrDefault("nodos",   List.of());
        List<Map<String, Object>> enlacesIA = (List<Map<String, Object>>) diagrama.getOrDefault("enlaces", List.of());

        // 3. Extraer carriles únicos en orden de aparición
        List<Map<String, Object>> carriles = new ArrayList<>();
        List<String> carrilesVistos = new ArrayList<>();
        AtomicInteger ordenCarril = new AtomicInteger(1);
        for (Map<String, Object> nodo : nodosIA) {
            String unidad = (String) nodo.getOrDefault("unidad", "GENERAL");
            if (!carrilesVistos.contains(unidad)) {
                carrilesVistos.add(unidad);
                Map<String, Object> carril = new HashMap<>();
                carril.put("id", unidad);
                String nombreCarril = unidad.toUpperCase().replace("_", " ");
                if (!nombreCarril.startsWith("CARRIL")) nombreCarril = "CARRIL DE " + nombreCarril;
                carril.put("nombre", nombreCarril);
                carril.put("orden", ordenCarril.getAndIncrement());
                carriles.add(carril);
            }
        }

        // 4. Construir mapa de predecesores: destinoId → padreId (primer predecesor)
        Map<String, String> predecesores = new HashMap<>();
        for (Map<String, Object> enlace : enlacesIA) {
            String from = (String) enlace.get("from");
            String to   = (String) enlace.get("to");
            predecesores.putIfAbsent(to, from);
        }

        // Convertir nodos IA → pasos Angular + crear Formulario_Nodo en MongoDB
        List<Map<String, Object>> pasos = new ArrayList<>();
        int xBase = 300, yBase = 140, xStep = 240;

        for (int i = 0; i < nodosIA.size(); i++) {
            Map<String, Object> nodo = nodosIA.get(i);
            String idNodo   = (String) nodo.get("id");
            String tipoIA   = (String) nodo.getOrDefault("tipo", "TAREA");
            String tipoAngular = convertirTipo(tipoIA);
            String unidad   = (String) nodo.getOrDefault("unidad", "GENERAL");
            int carrilesIdx = carrilesVistos.indexOf(unidad);
            List<Map<String, Object>> camposIA = (List<Map<String, Object>>) nodo.getOrDefault("campos", List.of());

            // Crear Formulario_Nodo en MongoDB para nodos TAREA con campos
            String formularioMongoId = null;
            if ("TAREA".equals(tipoAngular) && !camposIA.isEmpty()) {
                Formulario_Nodo fnodo = new Formulario_Nodo();
                fnodo.setId_nodo(idNodo);
                fnodo.setNombre_nodo((String) nodo.getOrDefault("nombre", "Tarea"));
                fnodo.setTipo_nodo("TASK");
                fnodo.setUnidad_id(unidad);
                fnodo.setPolitica_id(politicaId);
                fnodo.setActivo(true);
                fnodo.setPosicion_x(xBase + (i * xStep));
                fnodo.setPosicion_y(yBase + (carrilesIdx * 260));

                // Convertir campos al formato CampoFormulario de Angular
                List<Map<String, Object>> camposAngular = new ArrayList<>();
                for (int j = 0; j < camposIA.size(); j++) {
                    Map<String, Object> campoIA = camposIA.get(j);
                    Map<String, Object> campo = new HashMap<>();
                    campo.put("id", campoIA.getOrDefault("id", "c" + (j + 1)));
                    campo.put("formularioId", idNodo);
                    campo.put("tipo", convertirTipoCampo((String) campoIA.getOrDefault("tipo", "texto")));
                    campo.put("titulo", campoIA.getOrDefault("nombre", "Campo " + (j + 1)));
                    campo.put("placeholder", campoIA.getOrDefault("placeholder", ""));
                    campo.put("obligatorio", campoIA.getOrDefault("requerido", false));
                    campo.put("orden", j + 1);
                    // Opciones para tipo lista
                    if (campoIA.containsKey("opciones")) {
                        List<String> opcs = (List<String>) campoIA.get("opciones");
                        List<Map<String, Object>> opciones = new ArrayList<>();
                        for (String opc : opcs) {
                            Map<String, Object> o = new HashMap<>();
                            o.put("label", opc);
                            o.put("valor", opc.toLowerCase().replace(" ", "_"));
                            opciones.add(o);
                        }
                        campo.put("opciones", opciones);
                    }
                    camposAngular.add(campo);
                }
                fnodo.setEsquema_campos(camposAngular);
                Formulario_Nodo savedFnodo = formularioNodoRepository.save(fnodo);
                formularioMongoId = savedFnodo.getId();
            }

            // Construir paso Angular
            Map<String, Object> paso = new HashMap<>();
            paso.put("id", idNodo);
            paso.put("politicaId", politicaId);
            paso.put("nombre", nodo.getOrDefault("nombre", "Paso " + (i + 1)));
            paso.put("tipoPaso", tipoAngular);
            paso.put("departamentoId", unidad);
            paso.put("orden", i + 1);
            paso.put("obligatorio", !"INICIO".equals(tipoAngular) && !"FIN".equals(tipoAngular));
            paso.put("esUltimo", "FIN".equals(tipoAngular));
            paso.put("x", xBase + (i * xStep));
            paso.put("y", yBase + (carrilesIdx * 260));
            // Setear padreId desde mapa de predecesores
            String padreIdPaso = predecesores.get(idNodo);
            if (padreIdPaso != null) paso.put("padreId", padreIdPaso);
            if (formularioMongoId != null) {
                paso.put("formularioId", formularioMongoId);
                paso.put("campotipo", "texto_largo");
            }
            pasos.add(paso);
        }

        // 5. Convertir enlaces IA → relaciones Angular
        List<Map<String, Object>> relaciones = new ArrayList<>();
        for (Map<String, Object> enlace : enlacesIA) {
            Map<String, Object> rel = new HashMap<>();
            rel.put("id", UUID.randomUUID().toString());
            rel.put("politicaId", politicaId);
            rel.put("padreId", enlace.get("from"));
            rel.put("destinoId", enlace.get("to"));
            String condicion = (String) enlace.get("condicion");
            // "condicional" para que Angular renderice el label en morado
            rel.put("tipo", condicion != null && !condicion.isEmpty() ? "condicional" : "secuencial");
            rel.put("condicion", condicion);
            relaciones.add(rel);
        }

        // 6. Guardar esquema completo en la política existente
        WorkflowDTO workflowDTO = new WorkflowDTO();
        workflowDTO.setVersion("1");
        workflowDTO.setTipoFlujo("secuencial");
        workflowDTO.setPasos(pasos);
        workflowDTO.setRelaciones(relaciones);
        workflowDTO.setCarriles(carriles);
        workflowDTO.setFormularios(List.of());

        Politica actualizada = politicaService.actualizarEsquema(politicaId, workflowDTO);
        System.out.printf("✅ [IA] Diagrama en política %s: %d pasos, %d carriles, %d formularios%n",
                politicaId, pasos.size(), carriles.size(),
                pasos.stream().filter(p -> p.get("formularioId") != null).count());
        return actualizada;
    }

    /**
     * Edita el diagrama existente de una política usando una instrucción en lenguaje natural.
     * Recupera el esquema actual, lo manda a FastAPI junto con la instrucción,
     * y guarda el diagrama modificado en la misma política.
     */
    @SuppressWarnings("unchecked")
    public Politica editarDiagramaEnPolitica(String politicaId, String instruccion, String usuarioId) {
        Politica politica = politicaRepository.findById(politicaId)
                .orElseThrow(() -> new RuntimeException("Política no encontrada: " + politicaId));

        // 1. Obtener el esquema actual (formato Angular con pasos/relaciones/carriles)
        Map<String, Object> esquemaActual = politica.getEsquema_workflow();
        if (esquemaActual == null) {
            esquemaActual = new HashMap<>();
            esquemaActual.put("pasos", List.of());
            esquemaActual.put("relaciones", List.of());
            esquemaActual.put("carriles", List.of());
        }
        // Agregar nombre de la política para contexto
        esquemaActual.put("nombre", politica.getNombre());

        // 2. Llamar a FastAPI para editar el diagrama
        Map<String, Object> body = new HashMap<>();
        body.put("instruccion", instruccion);
        body.put("diagramaActual", esquemaActual);
        Map<String, Object> diagramaEditado = pythonAIService.editarDiagrama(body);

        // 3. Convertir la respuesta FastAPI (nodos/enlaces) al formato Angular (pasos/relaciones/carriles)
        List<Map<String, Object>> nodosIA   = (List<Map<String, Object>>) diagramaEditado.getOrDefault("nodos",   List.of());
        List<Map<String, Object>> enlacesIA = (List<Map<String, Object>>) diagramaEditado.getOrDefault("enlaces", List.of());

        // Extraer carriles únicos
        List<Map<String, Object>> carriles = new ArrayList<>();
        List<String> carrilesVistos = new ArrayList<>();
        AtomicInteger ordenCarril = new AtomicInteger(1);
        for (Map<String, Object> nodo : nodosIA) {
            String unidad = (String) nodo.getOrDefault("unidad", "GENERAL");
            if (!carrilesVistos.contains(unidad)) {
                carrilesVistos.add(unidad);
                Map<String, Object> carril = new HashMap<>();
                carril.put("id", unidad);
                String nombreCarril = unidad.toUpperCase().replace("_", " ");
                if (!nombreCarril.startsWith("CARRIL")) nombreCarril = "CARRIL DE " + nombreCarril;
                carril.put("nombre", nombreCarril);
                carril.put("orden", ordenCarril.getAndIncrement());
                carriles.add(carril);
            }
        }

        // Eliminar formularios anteriores y recrear
        List<Formulario_Nodo> nodosAntiguos = formularioNodoRepository.buscarPorPolitica(politicaId);
        formularioNodoRepository.deleteAll(nodosAntiguos);

        // Construir mapa de predecesores para editarDiagramaEnPolitica
        Map<String, String> predecesoresEdit = new HashMap<>();
        for (Map<String, Object> enlace : enlacesIA) {
            String from = (String) enlace.get("from");
            String to   = (String) enlace.get("to");
            predecesoresEdit.putIfAbsent(to, from);
        }

        // Convertir nodos → pasos
        List<Map<String, Object>> pasos = new ArrayList<>();
        int xBase = 300, yBase = 140, xStep = 240;
        for (int i = 0; i < nodosIA.size(); i++) {
            Map<String, Object> nodo = nodosIA.get(i);
            String idNodo       = (String) nodo.get("id");
            String tipoAngular  = convertirTipo((String) nodo.getOrDefault("tipo", "TASK"));
            String unidad       = (String) nodo.getOrDefault("unidad", "GENERAL");
            int carrilesIdx     = carrilesVistos.indexOf(unidad);
            List<Map<String, Object>> camposIA = (List<Map<String, Object>>) nodo.getOrDefault("campos", List.of());

            String formularioMongoId = null;
            if ("TAREA".equals(tipoAngular) && !camposIA.isEmpty()) {
                Formulario_Nodo fnodo = new Formulario_Nodo();
                fnodo.setId_nodo(idNodo);
                fnodo.setNombre_nodo((String) nodo.getOrDefault("nombre", "Tarea"));
                fnodo.setTipo_nodo("TASK");
                fnodo.setUnidad_id(unidad);
                fnodo.setPolitica_id(politicaId);
                fnodo.setActivo(true);
                fnodo.setPosicion_x(xBase + (i * xStep));
                fnodo.setPosicion_y(yBase + (carrilesIdx * 260));
                List<Map<String, Object>> camposAngular = new ArrayList<>();
                for (int j = 0; j < camposIA.size(); j++) {
                    Map<String, Object> campoIA = camposIA.get(j);
                    Map<String, Object> campo = new HashMap<>();
                    campo.put("id", campoIA.getOrDefault("id", "c" + (j + 1)));
                    campo.put("formularioId", idNodo);
                    campo.put("tipo", convertirTipoCampo((String) campoIA.getOrDefault("tipo", "texto")));
                    campo.put("titulo", campoIA.getOrDefault("nombre", "Campo " + (j + 1)));
                    campo.put("placeholder", campoIA.getOrDefault("placeholder", ""));
                    campo.put("obligatorio", campoIA.getOrDefault("requerido", false));
                    campo.put("orden", j + 1);
                    if (campoIA.containsKey("opciones")) {
                        List<String> opcs = (List<String>) campoIA.get("opciones");
                        List<Map<String, Object>> opciones = new ArrayList<>();
                        for (String opc : opcs) {
                            Map<String, Object> o = new HashMap<>();
                            o.put("label", opc); o.put("valor", opc.toLowerCase().replace(" ", "_"));
                            opciones.add(o);
                        }
                        campo.put("opciones", opciones);
                    }
                    camposAngular.add(campo);
                }
                fnodo.setEsquema_campos(camposAngular);
                formularioMongoId = formularioNodoRepository.save(fnodo).getId();
            }

            Map<String, Object> paso = new HashMap<>();
            paso.put("id", idNodo);
            paso.put("politicaId", politicaId);
            paso.put("nombre", nodo.getOrDefault("nombre", "Paso " + (i + 1)));
            paso.put("tipoPaso", tipoAngular);
            paso.put("departamentoId", unidad);
            paso.put("orden", i + 1);
            paso.put("obligatorio", !"INICIO".equals(tipoAngular) && !"FIN".equals(tipoAngular));
            paso.put("esUltimo", "FIN".equals(tipoAngular));
            paso.put("x", xBase + (i * xStep));
            paso.put("y", yBase + (carrilesIdx * 260));
            // Setear padreId desde mapa de predecesores (editar)
            String padreIdEdit = predecesoresEdit.get(idNodo);
            if (padreIdEdit != null) paso.put("padreId", padreIdEdit);
            if (formularioMongoId != null) {
                paso.put("formularioId", formularioMongoId);
                paso.put("campotipo", "texto_largo");
            }
            pasos.add(paso);
        }

        // Convertir enlaces → relaciones
        List<Map<String, Object>> relaciones = new ArrayList<>();
        for (Map<String, Object> enlace : enlacesIA) {
            Map<String, Object> rel = new HashMap<>();
            rel.put("id", UUID.randomUUID().toString());
            rel.put("politicaId", politicaId);
            rel.put("padreId", enlace.get("from"));
            rel.put("destinoId", enlace.get("to"));
            String condicion = (String) enlace.get("condicion");
            rel.put("tipo", condicion != null && !condicion.isEmpty() ? "condicional" : "secuencial");
            rel.put("condicion", condicion);
            relaciones.add(rel);
        }

        WorkflowDTO dto = new WorkflowDTO();
        dto.setVersion("1");
        dto.setTipoFlujo("secuencial");
        dto.setPasos(pasos);
        dto.setRelaciones(relaciones);
        dto.setCarriles(carriles);
        dto.setFormularios(List.of());

        System.out.printf("✅ [IA-EDITAR] Política %s editada: %d pasos, instrucción: %s%n",
                politicaId, pasos.size(), instruccion);
        return politicaService.actualizarEsquema(politicaId, dto);
    }

    /**
     * Genera diagrama con IA y crea una NUEVA política (comportamiento original).
     */
    public Politica generarYGuardarPolitica(String descripcion, String empresaId, String usuarioId) {
        Map<String, Object> diagrama = generarDiagramaDesdeTexto(descripcion, empresaId);
        Politica politica = new Politica();
        politica.setNombre((String) diagrama.getOrDefault("nombre", "Política generada por IA"));
        politica.setTipo_flujo("IA_GENERATED");
        politica.setEsta_activa(true);
        politica.setFecha_activacion(LocalDateTime.now());
        politica.setEmpresa_id(empresaId);
        politica.setEsquema_workflow(diagrama);
        System.out.println("✅ [IA] Nueva política generada: " + politica.getNombre());
        return politicaRepository.save(politica);
    }
}
