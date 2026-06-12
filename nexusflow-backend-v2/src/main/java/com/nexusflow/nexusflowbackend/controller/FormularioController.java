package com.nexusflow.nexusflowbackend.controller;

import com.nexusflow.nexusflowbackend.model.Formulario_Nodo;
import com.nexusflow.nexusflowbackend.repository.FormularioNodoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Controller para compatibilidad con el Frontend (CU-11).
 * Mapea las peticiones de /api/formularios al repositorio de Formulario_Nodo.
 */
@RestController
@RequestMapping("/api/formularios")
@CrossOrigin(origins = "*")
public class FormularioController {

    @Autowired
    private FormularioNodoRepository repository;

    @GetMapping
    public List<Formulario_Nodo> listar(@RequestParam(required = false) String politicaId) {
        List<Formulario_Nodo> todos = repository.findAll();
        if (politicaId != null && !politicaId.isEmpty()) {
            final String filterId = politicaId;
            return todos.stream()
                    .filter(f -> filterId.equals(f.getPolitica_id()))
                    .collect(Collectors.toList());
        }
        return todos;
    }

    @GetMapping("/{id}")
    public Formulario_Nodo obtener(@PathVariable String id) {
        return repository.findById(id).orElse(null);
    }

    @PostMapping
    public Formulario_Nodo crear(@RequestBody Formulario_Nodo formulario) {
        return repository.save(formulario);
    }

    @PutMapping("/{id}")
    public Formulario_Nodo actualizar(@PathVariable String id, @RequestBody Formulario_Nodo formulario) {
        formulario.setId(id);
        return repository.save(formulario);
    }

    @DeleteMapping("/{id}")
    public void eliminar(@PathVariable String id) {
        repository.deleteById(id);
    }

    // ---- Campos ----

    @PostMapping("/{id}/campos")
    public org.springframework.http.ResponseEntity<?> agregarCampo(@PathVariable String id, @RequestBody java.util.Map<String, Object> campo) {
        Formulario_Nodo formulario = repository.findById(id).orElse(null);
        if (formulario == null) return org.springframework.http.ResponseEntity.notFound().build();
        
        List<java.util.Map<String, Object>> campos = formulario.getEsquema_campos();
        if (campos == null) {
            campos = new java.util.ArrayList<>();
        } else {
            campos = new java.util.ArrayList<>(campos);
        }
        campos.add(campo);
        formulario.setEsquema_campos(campos);
        repository.save(formulario);
        return org.springframework.http.ResponseEntity.ok(campo);
    }

    @PutMapping("/{id}/campos/{campoId}")
    public org.springframework.http.ResponseEntity<?> actualizarCampo(@PathVariable String id, @PathVariable String campoId, @RequestBody java.util.Map<String, Object> campo) {
        Formulario_Nodo formulario = repository.findById(id).orElse(null);
        if (formulario == null) return org.springframework.http.ResponseEntity.notFound().build();
        
        List<java.util.Map<String, Object>> camposActuales = formulario.getEsquema_campos();
        if (camposActuales != null) {
            List<java.util.Map<String, Object>> campos = new java.util.ArrayList<>(camposActuales);
            for (int i = 0; i < campos.size(); i++) {
                java.util.Map<String, Object> c = campos.get(i);
                if (campoId.equals(c.get("id")) || campoId.equals(c.get("name"))) {
                    campos.set(i, campo);
                    formulario.setEsquema_campos(campos);
                    repository.save(formulario);
                    return org.springframework.http.ResponseEntity.ok(campo);
                }
            }
        }
        return org.springframework.http.ResponseEntity.notFound().build();
    }

    @DeleteMapping("/{id}/campos/{campoId}")
    public org.springframework.http.ResponseEntity<?> eliminarCampo(@PathVariable String id, @PathVariable String campoId) {
        Formulario_Nodo formulario = repository.findById(id).orElse(null);
        if (formulario == null) return org.springframework.http.ResponseEntity.notFound().build();
        
        List<java.util.Map<String, Object>> camposActuales = formulario.getEsquema_campos();
        if (camposActuales != null) {
            List<java.util.Map<String, Object>> campos = new java.util.ArrayList<>(camposActuales);
            campos.removeIf(c -> campoId.equals(c.get("id")) || campoId.equals(c.get("name")));
            formulario.setEsquema_campos(campos);
            repository.save(formulario);
        }
        return org.springframework.http.ResponseEntity.ok().build();
    }
}
