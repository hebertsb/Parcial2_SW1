package com.nexusflow.nexusflowbackend.controller;

import com.nexusflow.nexusflowbackend.model.Empresa;
import com.nexusflow.nexusflowbackend.service.EmpresaService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/empresas")
@CrossOrigin(origins = "*") // Para que React o Flutter puedan conectarse sin problemas
public class EmpresaController {

    @Autowired
    private EmpresaService empresaService;

    @Autowired
    private com.nexusflow.nexusflowbackend.service.UsuarioService usuarioService;

    @Autowired
    private com.nexusflow.nexusflowbackend.service.RolService rolService;

    @GetMapping
    public List<Empresa> listar() {
        return empresaService.obtenerTodas();
    }

    @PostMapping
    public Empresa crear(@RequestBody Empresa empresa) {
        return empresaService.guardar(empresa);
    }

    /**
     * CU-04: Registrar Empresa + Administrador (Registro Dual)
     */
    @PostMapping("/registrar-con-admin")
    public ResponseEntity<?> registrarEmpresaConAdmin(@RequestBody Map<String, Object> request) {
        try {
            // 1. Extraer y crear Empresa
            Map<String, String> empresaData = (Map<String, String>) request.get("empresa");
            Empresa nuevaEmpresa = new Empresa();
            nuevaEmpresa.setNombre_legal(empresaData.get("nombre_legal"));
            nuevaEmpresa.setNit(empresaData.get("nit"));
            nuevaEmpresa.setTelefono(empresaData.get("telefono"));
            nuevaEmpresa.setDireccion(empresaData.get("direccion"));
            nuevaEmpresa.setEstado(empresaData.get("estado"));
            nuevaEmpresa.setPlan_suscripcion(empresaData.get("plan_suscripcion"));

            Empresa empresaGuardada = empresaService.guardar(nuevaEmpresa);

            // 2. Extraer y crear Admin para esa Empresa
            Map<String, String> adminData = (Map<String, String>) request.get("admin");
            com.nexusflow.nexusflowbackend.model.Usuario nuevoAdmin = new com.nexusflow.nexusflowbackend.model.Usuario();
            nuevoAdmin.setNombre_completo(adminData.get("nombre_completo"));
            nuevoAdmin.setCorreo_electronico(adminData.get("correo_electronico"));
            nuevoAdmin.setClave_hash(adminData.get("clave_hash"));
            nuevoAdmin.setEmpresa_id(empresaGuardada.getId());
            nuevoAdmin.setEsta_activo(true);

            // Buscar Rol-Admin, o crearlo si la base de datos está vacía
            com.nexusflow.nexusflowbackend.model.Rol rolAdmin = rolService.obtenerTodos().stream()
                    .filter(r -> "ROL-ADMIN".equals(r.getNombre_rol()))
                    .findFirst()
                    .orElseGet(() -> {
                        com.nexusflow.nexusflowbackend.model.Rol nuevoRolAdmin = new com.nexusflow.nexusflowbackend.model.Rol();
                        nuevoRolAdmin.setNombre_rol("ROL-ADMIN");
                        nuevoRolAdmin.setEs_nucleo(true);
                        // Permisos por defecto para Admin
                        nuevoRolAdmin.getPermisos().put("VER_DASHBOARD", true);
                        nuevoRolAdmin.getPermisos().put("GESTIONAR_USUARIOS", true);
                        return rolService.guardar(nuevoRolAdmin);
                    });

            nuevoAdmin.setRol_id(rolAdmin.getId());
            usuarioService.guardar(nuevoAdmin);

            return ResponseEntity.ok(Map.of(
                "mensaje", "Empresa y Administrador registrados correctamente", 
                "empresa", empresaGuardada
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<Empresa> buscarPorId(@PathVariable String id) {
        return empresaService.obtenerPorId(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * PUT: Actualizar una empresa existente
     * CU-04: Editar Empresa
     */
    @PutMapping("/{id}")
    public ResponseEntity<Empresa> actualizar(@PathVariable String id, @RequestBody Empresa empresaDetalles) {
        return empresaService.obtenerPorId(id).map(empresa -> {
            empresa.setNombre_legal(empresaDetalles.getNombre_legal());
            empresa.setNit(empresaDetalles.getNit());
            empresa.setTelefono(empresaDetalles.getTelefono());
            empresa.setDireccion(empresaDetalles.getDireccion());
            empresa.setEstado(empresaDetalles.getEstado());
            empresa.setPlan_suscripcion(empresaDetalles.getPlan_suscripcion());

            Empresa actualizada = empresaService.guardar(empresa);
            return ResponseEntity.ok(actualizada);
        }).orElse(ResponseEntity.notFound().build());
    }

    /**
     * DELETE: Eliminar una empresa por ID
     * CU-04: Eliminar Empresa
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> eliminar(@PathVariable String id) {
        try {
            empresaService.eliminar(id);
            return ResponseEntity.ok(Map.of("mensaje", "Empresa eliminada correctamente de la base NoSQL"));
        } catch (Exception e) {
            return ResponseEntity.status(404).body(Map.of("error", "No se encontró la empresa con el ID proporcionado"));
        }
    }
}