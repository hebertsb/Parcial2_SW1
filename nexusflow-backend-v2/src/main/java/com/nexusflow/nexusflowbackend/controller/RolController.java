package com.nexusflow.nexusflowbackend.controller;

import com.nexusflow.nexusflowbackend.model.Rol;
import com.nexusflow.nexusflowbackend.service.RolService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/roles")
@CrossOrigin(origins = "*")
public class RolController {

    @Autowired
    private RolService rolService;

    /**
     * GET: Listar todos los roles (Útil para SuperAdmin)
     */
    @GetMapping
    public List<Rol> listarTodos() {
        return rolService.obtenerTodos();
    }

    /**
     * GET: Listar roles por Empresa
     * CU-05: Visualizar roles de la organización
     */
    @GetMapping("/empresa/{empresaId}")
    public List<Rol> listarPorEmpresa(@PathVariable String empresaId) {
        return rolService.obtenerPorEmpresa(empresaId);
    }

    /**
     * POST: Crear o actualizar un rol (CU-05)
     */
    @PostMapping
    public Rol crear(@RequestBody Rol rol) {
        return rolService.guardar(rol);
    }

    /**
     * GET: Buscar un rol específico
     */
    @GetMapping("/{id}")
    public ResponseEntity<Rol> buscar(@PathVariable String id) {
        return rolService.obtenerPorId(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * DELETE: Eliminar un rol
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> eliminar(@PathVariable String id) {
        try {
            rolService.eliminar(id);
            return ResponseEntity.ok(Map.of("mensaje", "Rol eliminado correctamente"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    /**
     * PUT: Actualizar un rol existente
     */
    @PutMapping("/{id}")
    public ResponseEntity<Rol> actualizar(@PathVariable String id, @RequestBody Rol rol) {
        return rolService.obtenerPorId(id)
                .map(rolExistente -> {
                    rol.setId(id); // <--- IMPORTANTE: Mantenemos el ID de la URL
                    return ResponseEntity.ok(rolService.guardar(rol));
                })
                .orElse(ResponseEntity.notFound().build());
    }
}