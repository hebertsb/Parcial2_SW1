package com.nexusflow.nexusflowbackend.controller;

import com.nexusflow.nexusflowbackend.model.Unidad_Organizacional;
import com.nexusflow.nexusflowbackend.service.UnidadService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/unidades")
@CrossOrigin(origins = "*")
public class UnidadController {

    @Autowired
    private UnidadService unidadService;

    @GetMapping
    public List<Unidad_Organizacional> listar() {
        return unidadService.obtenerTodas();
    }

    @GetMapping("/empresa/{empresaId}")
    public List<Unidad_Organizacional> listarPorEmpresa(@PathVariable String empresaId) {
        return unidadService.obtenerPorEmpresa(empresaId);
    }

    @PostMapping
    public Unidad_Organizacional crear(@RequestBody Unidad_Organizacional unidad) {
        return unidadService.guardar(unidad);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Unidad_Organizacional> obtener(@PathVariable String id) {
        return unidadService.obtenerPorId(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // Método para Actualizar (CU-06 Editar)
    @PutMapping("/{id}")
    public ResponseEntity<Unidad_Organizacional> actualizar(@PathVariable String id, @RequestBody Unidad_Organizacional unidadDetails) {
        return unidadService.obtenerPorId(id).map(unidad -> {
            unidad.setNombre(unidadDetails.getNombre());
            unidad.setSigla(unidadDetails.getSigla());
            unidad.setPadre_id(unidadDetails.getPadre_id());
            unidad.setEsta_activa(unidadDetails.getEsta_activa());
            return ResponseEntity.ok(unidadService.guardar(unidad));
        }).orElse(ResponseEntity.notFound().build());
    }
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminarLogico(@PathVariable String id) {
        unidadService.eliminarLogico(id);
        return ResponseEntity.noContent().build();
    }
}