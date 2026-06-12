package com.nexusflow.nexusflowbackend.service;

import com.nexusflow.nexusflowbackend.model.*;
import net.sourceforge.plantuml.SourceStringReader;
import org.springframework.stereotype.Service;
import java.io.ByteArrayOutputStream;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ExportService {

    // ============================================================
    // EXPORTAR A PNG con PlantUML basado en el esquema real
    // ============================================================
    public byte[] exportarAPNG(Politica politica, List<Formulario_Nodo> nodos,
                               List<Map<String, Object>> relaciones) {
        String codigoPlantUml = generarCodigoPlantUML(politica, nodos, relaciones);
        System.out.println("=== PLANTUML GENERADO ===\n" + codigoPlantUml + "\n=========================");
        try {
            SourceStringReader reader = new SourceStringReader(codigoPlantUml);
            ByteArrayOutputStream os = new ByteArrayOutputStream();
            reader.generateImage(os);
            return os.toByteArray();
        } catch (Exception e) {
            e.printStackTrace();
            return new byte[0];
        }
    }

    // Sobrecarga sin relaciones para compatibilidad con llamadas anteriores
    public byte[] exportarAPNG(Politica politica, List<Formulario_Nodo> nodos) {
        return exportarAPNG(politica, nodos, Collections.emptyList());
    }

    // ============================================================
    // PLANTUML — swimlanes dinámicas + flechas reales
    // ============================================================
    private String generarCodigoPlantUML(Politica politica, List<Formulario_Nodo> nodos,
                                          List<Map<String, Object>> relaciones) {
        if (nodos == null || nodos.isEmpty()) {
            return "@startuml\nstart\n:No hay nodos;\nstop\n@enduml";
        }

        // Mapa nodoId → nodo para lookups rápidos
        Map<String, Formulario_Nodo> nodoMap = new LinkedHashMap<>();
        for (Formulario_Nodo n : nodos) {
            if (n != null && n.getId() != null) nodoMap.put(n.getId(), n);
            // También indexar por id_nodo si existe
            if (n != null && n.getId_nodo() != null) nodoMap.put(n.getId_nodo(), n);
        }

        // Detectar nodo de inicio (tipo INICIO o sin entradas)
        Set<String> tienenEntrada = new HashSet<>();
        for (Map<String, Object> rel : relaciones) {
            String dest = getString(rel, "destinoId", getString(rel, "to", null));
            if (dest != null) tienenEntrada.add(dest);
        }

        // Separar por tipo
        Formulario_Nodo nodoInicio = null;
        Formulario_Nodo nodoFin = null;
        List<Formulario_Nodo> nodosTarea = new ArrayList<>();
        List<Formulario_Nodo> nodosGateway = new ArrayList<>();

        for (Formulario_Nodo nodo : nodos) {
            if (nodo == null) continue;
            String tipo = nodo.getTipo_nodo();
            if (tipo == null) tipo = "";
            if ("INICIO".equalsIgnoreCase(tipo) || "NODO_INICIO".equalsIgnoreCase(tipo)) {
                nodoInicio = nodo;
            } else if ("FIN".equalsIgnoreCase(tipo) || "NODO_FIN".equalsIgnoreCase(tipo)) {
                nodoFin = nodo;
            } else if ("GATEWAY".equalsIgnoreCase(tipo) || "DECISION".equalsIgnoreCase(tipo)) {
                nodosGateway.add(nodo);
            } else {
                nodosTarea.add(nodo);
            }
        }
        // Si no hay nodo de tipo INICIO, elegir el que no tiene entradas
        if (nodoInicio == null) {
            for (Formulario_Nodo n : nodos) {
                if (n == null) continue;
                boolean tieneEntrada = tienenEntrada.contains(n.getId())
                        || (n.getId_nodo() != null && tienenEntrada.contains(n.getId_nodo()));
                if (!tieneEntrada) {
                    nodoInicio = n;
                    nodosTarea.remove(n);
                    break;
                }
            }
        }
        // Si no hay nodo FIN, elegir el último por orden
        if (nodoFin == null && !nodosTarea.isEmpty()) {
            nodoFin = nodosTarea.remove(nodosTarea.size() - 1);
        }

        // Agrupar por swimlane (departamentoId / unidad_id)
        // Formato relación: { padreId, destinoId, tipo }
        Map<String, List<Formulario_Nodo>> swimlanes = new LinkedHashMap<>();
        for (Formulario_Nodo n : nodos) {
            if (n == null) continue;
            String lane = n.getUnidad_id();
            if (lane == null || lane.isBlank()) lane = "Proceso";
            swimlanes.computeIfAbsent(lane, k -> new ArrayList<>()).add(n);
        }

        StringBuilder sb = new StringBuilder();
        sb.append("@startuml\n");
        sb.append("title\n");
        sb.append("  <size:18><b>DIAGRAMA DE ACTIVIDAD UML 2.5</b></size>\n");
        sb.append("  <size:14>").append(esc(politica.getNombre())).append("</size>\n");
        sb.append("end title\n\n");
        sb.append("skinparam activityShape roundBox\n");
        sb.append("skinparam swimlaneWidth 240\n");
        sb.append("skinparam swimlaneTitleFontSize 13\n");
        sb.append("skinparam activityFontSize 12\n");
        sb.append("skinparam backgroundColor #FFFFFF\n");
        sb.append("skinparam activity {\n  BorderColor #333333\n  BackgroundColor #FEF9E6\n}\n");
        sb.append("skinparam swimlane {\n  BorderColor #0066CC\n  BorderThickness 2\n  BackgroundColor #E6F3FF\n}\n");
        sb.append("skinparam arrow {\n  Color #0066CC\n  Thickness 2\n}\n");
        sb.append("scale 1.2\n\n");

        if (swimlanes.size() <= 1 || relaciones.isEmpty()) {
            // Sin swimlanes o sin relaciones: flujo lineal simple
            sb.append("start\n");
            if (nodoInicio != null) sb.append(":").append(esc(nodoInicio.getNombre_nodo())).append(";\n");
            for (Formulario_Nodo t : nodosTarea) sb.append(":").append(esc(t.getNombre_nodo())).append(";\n");
            for (Formulario_Nodo g : nodosGateway) {
                sb.append("if (").append(esc(g.getNombre_nodo())).append("?) then (Sí)\n");
                sb.append("else (No)\nendif\n");
            }
            if (nodoFin != null) sb.append(":").append(esc(nodoFin.getNombre_nodo())).append(";\n");
            sb.append("stop\n");
        } else {
            // Con swimlanes: topological sort por relaciones
            // Construir orden de nodos según relaciones (BFS desde inicio)
            List<String> ordenNodos = topoSort(nodoMap, nodoInicio, relaciones);

            String laneActual = null;
            boolean startEmitido = false;

            for (String nId : ordenNodos) {
                Formulario_Nodo n = nodoMap.get(nId);
                if (n == null) continue;
                String lane = n.getUnidad_id();
                if (lane == null || lane.isBlank()) lane = "Proceso";

                if (!lane.equals(laneActual)) {
                    sb.append("|").append(esc(lane)).append("|\n");
                    laneActual = lane;
                }

                String tipo = n.getTipo_nodo() != null ? n.getTipo_nodo().toUpperCase() : "TAREA";
                if (!startEmitido && ("INICIO".equals(tipo) || "NODO_INICIO".equals(tipo))) {
                    sb.append("start\n");
                    sb.append(":").append(esc(n.getNombre_nodo())).append(";\n");
                    startEmitido = true;
                } else if ("FIN".equals(tipo) || "NODO_FIN".equals(tipo)) {
                    sb.append(":").append(esc(n.getNombre_nodo())).append(";\n");
                    sb.append("stop\n");
                } else if ("GATEWAY".equals(tipo) || "DECISION".equals(tipo)) {
                    sb.append("if (").append(esc(n.getNombre_nodo())).append("?) then (Sí)\n");
                    sb.append("else (No)\nendif\n");
                } else {
                    if (!startEmitido) { sb.append("start\n"); startEmitido = true; }
                    sb.append(":").append(esc(n.getNombre_nodo())).append(";\n");
                }
            }
            if (!startEmitido) sb.append("start\n");
        }

        sb.append("@enduml");
        return sb.toString();
    }

    // BFS/topological sort desde nodo inicio
    private List<String> topoSort(Map<String, Formulario_Nodo> nodoMap,
                                   Formulario_Nodo inicio,
                                   List<Map<String, Object>> relaciones) {
        // adjacency: padreId → list of destinoId
        Map<String, List<String>> adj = new LinkedHashMap<>();
        for (Map<String, Object> rel : relaciones) {
            String from = getString(rel, "padreId", getString(rel, "from", null));
            String to = getString(rel, "destinoId", getString(rel, "to", null));
            if (from != null && to != null) {
                adj.computeIfAbsent(from, k -> new ArrayList<>()).add(to);
            }
        }

        List<String> orden = new ArrayList<>();
        Set<String> visitado = new LinkedHashSet<>();
        Queue<String> queue = new LinkedList<>();

        String inicioId = inicio != null ? (nodoMap.containsKey(inicio.getId()) ? inicio.getId() : inicio.getId_nodo()) : null;
        if (inicioId != null) queue.add(inicioId);

        // Agregar cualquier nodo no alcanzable por inicio
        for (String id : nodoMap.keySet()) {
            if (!visitado.contains(id) && !queue.contains(id) && id.equals(inicioId)) {
                // ya en queue
            }
        }

        while (!queue.isEmpty()) {
            String curr = queue.poll();
            if (visitado.contains(curr)) continue;
            visitado.add(curr);
            orden.add(curr);
            List<String> vecinos = adj.getOrDefault(curr, Collections.emptyList());
            queue.addAll(vecinos);
        }

        // Agregar nodos no visitados al final
        for (String id : nodoMap.keySet()) {
            if (!visitado.contains(id) && nodoMap.get(id) != null) orden.add(id);
        }

        return orden;
    }

    // ============================================================
    // GENERAR XMI UML 2.5 — con particiones y ControlFlows
    // ============================================================
    public String generarXMI(Politica politica, List<Formulario_Nodo> nodos,
                              List<Map<String, Object>> relaciones) {
        StringBuilder xmi = new StringBuilder();

        xmi.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xmi.append("<xmi:XMI xmi:version=\"2.5.1\"")
           .append(" xmlns:uml=\"http://www.omg.org/spec/UML/20110701/UML.xmi\"")
           .append(" xmlns:xmi=\"http://www.omg.org/spec/XMI/20110701\">\n");
        xmi.append("  <xmi:Documentation exporter=\"NexusFlow CASE Tool\" exporterVersion=\"2.5.1\"/>\n");
        xmi.append("  <uml:Model xmi:type=\"uml:Model\" xmi:id=\"MODEL_1\" name=\"NexusFlow_Model\">\n");

        String actId = "ACT_" + politica.getId();
        xmi.append("    <packagedElement xmi:type=\"uml:Activity\" xmi:id=\"").append(actId)
           .append("\" name=\"").append(xmlEsc(politica.getNombre())).append("\">\n");

        // Mapa seguro nodo-id → xmi-id (para los ControlFlows)
        Map<String, String> idMap = new LinkedHashMap<>();
        // Agrupar nodos por swimlane (unidad_id)
        Map<String, List<Formulario_Nodo>> lanes = new LinkedHashMap<>();
        for (Formulario_Nodo n : nodos) {
            if (n == null) continue;
            String lane = n.getUnidad_id();
            if (lane == null || lane.isBlank()) lane = "Proceso";
            lanes.computeIfAbsent(lane, k -> new ArrayList<>()).add(n);
        }

        // Nodo InitialNode siempre presente
        xmi.append("      <node xmi:type=\"uml:InitialNode\" xmi:id=\"INIT_NODE\"/>\n");

        int partCounter = 1;
        int nodeCounter = 1;
        for (Map.Entry<String, List<Formulario_Nodo>> entry : lanes.entrySet()) {
            String partId = "PART_" + partCounter++;
            xmi.append("      <partition xmi:type=\"uml:ActivityPartition\" xmi:id=\"")
               .append(partId).append("\" name=\"").append(xmlEsc(entry.getKey())).append("\">\n");

            for (Formulario_Nodo n : entry.getValue()) {
                if (n == null) continue;
                String xmiId = "N_" + nodeCounter++;
                // Registrar en el mapa con ambos ids posibles
                if (n.getId() != null) idMap.put(n.getId(), xmiId);
                if (n.getId_nodo() != null) idMap.put(n.getId_nodo(), xmiId);

                String tipoUml = mapearTipoUML(n.getTipo_nodo());
                String nombre = n.getNombre_nodo() != null ? n.getNombre_nodo() : "Sin nombre";
                xmi.append("        <node xmi:type=\"").append(tipoUml)
                   .append("\" xmi:id=\"").append(xmiId)
                   .append("\" name=\"").append(xmlEsc(nombre)).append("\"/>\n");
            }
            xmi.append("      </partition>\n");
        }

        // Si no hay swimlanes o están vacíos, generar nodos directos
        if (lanes.isEmpty()) {
            for (Formulario_Nodo n : nodos) {
                if (n == null) continue;
                String xmiId = "N_" + nodeCounter++;
                if (n.getId() != null) idMap.put(n.getId(), xmiId);
                if (n.getId_nodo() != null) idMap.put(n.getId_nodo(), xmiId);
                String tipoUml = mapearTipoUML(n.getTipo_nodo());
                String nombre = n.getNombre_nodo() != null ? n.getNombre_nodo() : "Sin nombre";
                xmi.append("      <node xmi:type=\"").append(tipoUml)
                   .append("\" xmi:id=\"").append(xmiId)
                   .append("\" name=\"").append(xmlEsc(nombre)).append("\"/>\n");
            }
        }

        // Nodo FinalNode siempre presente
        xmi.append("      <node xmi:type=\"uml:ActivityFinalNode\" xmi:id=\"FINAL_NODE\"/>\n");

        // ControlFlows basados en relaciones reales
        int cfCounter = 1;
        // Enlazar InitialNode con el primer nodo (sin entradas)
        Set<String> tienenEntrada = new HashSet<>();
        for (Map<String, Object> rel : relaciones) {
            String dest = getString(rel, "destinoId", getString(rel, "to", null));
            if (dest != null) tienenEntrada.add(dest);
        }
        for (Formulario_Nodo n : nodos) {
            if (n == null) continue;
            boolean sinEntrada = !tienenEntrada.contains(n.getId())
                    && (n.getId_nodo() == null || !tienenEntrada.contains(n.getId_nodo()));
            String xmiDest = idMap.get(n.getId());
            if (xmiDest == null && n.getId_nodo() != null) xmiDest = idMap.get(n.getId_nodo());
            if (sinEntrada && xmiDest != null) {
                xmi.append("      <edge xmi:type=\"uml:ControlFlow\" xmi:id=\"CF_INIT_").append(cfCounter++)
                   .append("\" source=\"INIT_NODE\" target=\"").append(xmiDest).append("\"/>\n");
            }
        }

        for (Map<String, Object> rel : relaciones) {
            String from = getString(rel, "padreId", getString(rel, "from", null));
            String to = getString(rel, "destinoId", getString(rel, "to", null));
            if (from == null || to == null) continue;

            String xmiFrom = idMap.get(from);
            String xmiTo = idMap.get(to);
            if (xmiFrom == null || xmiTo == null) continue;

            String cfId = "CF_" + cfCounter++;
            String guardStr = "";
            Object cond = rel.get("condicion");
            if (cond instanceof Map<?, ?> condMap) {
                Object op = condMap.get("operador");
                Object val = condMap.get("valorEsperado");
                if (op != null && val != null) guardStr = " guard=\"" + xmlEsc(op + " " + val) + "\"";
            }

            xmi.append("      <edge xmi:type=\"uml:ControlFlow\" xmi:id=\"").append(cfId)
               .append("\" source=\"").append(xmiFrom)
               .append("\" target=\"").append(xmiTo).append("\"")
               .append(guardStr).append("/>\n");
        }

        // Enlazar último nodo (sin salidas) con FinalNode
        Set<String> tienenSalida = new HashSet<>();
        for (Map<String, Object> rel : relaciones) {
            String src = getString(rel, "padreId", getString(rel, "from", null));
            if (src != null) tienenSalida.add(src);
        }
        for (Formulario_Nodo n : nodos) {
            if (n == null) continue;
            boolean sinSalida = !tienenSalida.contains(n.getId())
                    && (n.getId_nodo() == null || !tienenSalida.contains(n.getId_nodo()));
            String xmiSrc = idMap.get(n.getId());
            if (xmiSrc == null && n.getId_nodo() != null) xmiSrc = idMap.get(n.getId_nodo());
            if (sinSalida && xmiSrc != null) {
                xmi.append("      <edge xmi:type=\"uml:ControlFlow\" xmi:id=\"CF_FINAL_").append(cfCounter++)
                   .append("\" source=\"").append(xmiSrc).append("\" target=\"FINAL_NODE\"/>\n");
            }
        }

        xmi.append("    </packagedElement>\n");
        xmi.append("  </uml:Model>\n");
        xmi.append("</xmi:XMI>");

        return xmi.toString();
    }

    // Sobrecarga para compatibilidad
    public String generarXMI(Politica politica, List<Formulario_Nodo> nodos) {
        return generarXMI(politica, nodos, Collections.emptyList());
    }

    // ============================================================
    // Helpers
    // ============================================================
    private String mapearTipoUML(String tipoNexus) {
        if (tipoNexus == null) return "uml:OpaqueAction";
        return switch (tipoNexus.toUpperCase()) {
            case "INICIO", "NODO_INICIO" -> "uml:InitialNode";
            case "GATEWAY", "DECISION"   -> "uml:DecisionNode";
            case "FIN", "NODO_FIN"       -> "uml:ActivityFinalNode";
            default                      -> "uml:OpaqueAction";
        };
    }

    private String getString(Map<String, Object> map, String key, String defaultValue) {
        Object val = map.get(key);
        return val instanceof String s ? s : defaultValue;
    }

    private String esc(String s) {
        if (s == null) return "";
        return s.replace("\"", "'").replace("\n", " ").replace("|", "-");
    }

    private String xmlEsc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
