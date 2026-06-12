package com.nexusflow.nexusflowbackend.controller;

import com.nexusflow.nexusflowbackend.model.Rol;
import com.nexusflow.nexusflowbackend.model.Usuario;
import com.nexusflow.nexusflowbackend.service.RolService;
import com.nexusflow.nexusflowbackend.service.UsuarioService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/usuarios")
@CrossOrigin(origins = "*")
public class UsuarioController {

    @Autowired
    private UsuarioService usuarioService;

    @Autowired
    private RolService rolService;

    @GetMapping
    public List<Usuario> getAllUsuarios() {
        return usuarioService.obtenerTodos();
    }

    @GetMapping("/empresa/{empresaId}")
    public List<Usuario> getUsuariosByEmpresa(@PathVariable String empresaId) {
        return usuarioService.obtenerPorEmpresa(empresaId);
    }

    /**
     * Endpoint Privado: Para que el Administrador registre empleados/funcionarios.
     * Permite asignar roles como DISEÑADOR_PROCESOS o SECRETARIA.
     */
    @PostMapping
    public Usuario crearEmpleadoAdmin(@RequestBody Usuario usuario) {
        return usuarioService.guardar(usuario);
    }

    /**
     * Endpoint Público: Auto-registro de clientes desde la página de login.
     * Busca automáticamente el rol ROL-CLIENTE y lo asigna.
     * Previene escalada de privilegios (no acepta rol_id del body).
     */
    @PostMapping("/registrar")
    public ResponseEntity<?> registrarPublico(@RequestBody Usuario usuario) {
        try {
            // Buscar el rol CLIENTE por nombre (insensible a variantes de nombre)
            Optional<Rol> rolCliente = rolService.obtenerTodos().stream()
                    .filter(r -> r.getNombre_rol() != null &&
                            (r.getNombre_rol().toUpperCase().contains("CLIENTE")
                             || r.getNombre_rol().toUpperCase().contains("CLIENT")))
                    .findFirst();

            // Asignar rol encontrado, o usar el ID fijo como fallback
            rolCliente.ifPresent(r -> usuario.setRol_id(r.getId()));
            if (rolCliente.isEmpty()) {
                // Fallback: usar el mismo ID que usa el login (ROL-CLIENTE)
                usuario.setRol_id("ROL-CLIENTE");
            }

            Usuario creado = usuarioService.guardar(usuario);
            return ResponseEntity.ok(Map.of(
                    "id", creado.getId(),
                    "nombre_completo", creado.getNombre_completo(),
                    "correo_electronico", creado.getCorreo_electronico(),
                    "rol_id", creado.getRol_id() != null ? creado.getRol_id() : ""
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/buscar")
    public Usuario getUsuarioByEmail(@RequestParam String email) {
        return usuarioService.buscarPorEmail(email).orElse(null);
    }

    /**
     * PUT: Actualizar datos (CU-01)
     */
    @PutMapping("/{id}")
    public ResponseEntity<Usuario> actualizar(@PathVariable String id, @RequestBody Usuario usuario) {
        return ResponseEntity.ok(usuarioService.actualizar(id, usuario));
    }

    /**
     * DELETE: Desactivación Lógica (CU-01)
     * Reemplaza a la eliminación física para mantener trazabilidad.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> desactivar(@PathVariable String id) {
        try {
            usuarioService.desactivar(id);
            return ResponseEntity.ok(Map.of("mensaje", "Usuario desactivado correctamente (Baja Lógica)"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    /**
     * Paso 1: Solicitar recuperación (CU-02)
     * Ahora recibe un JSON para que sea más fácil de probar en Postman.
     */
    @PostMapping("/recuperar-password")
    public ResponseEntity<?> solicitarRecuperacion(@RequestBody Map<String, String> request) {
        try {
            String email = request.get("email");
            String token = usuarioService.generarTokenRecuperacion(email);
            return ResponseEntity.ok(Map.of(
                    "mensaje", "Se ha generado el token de recuperación",
                    "token_generado", token // Te lo devuelvo aquí para que lo copies rápido
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Paso 2: Cambiar la contraseña usando el token (CU-02)
     * Recibe el token y la nueva_password.
     */
    @PostMapping("/restablecer-password")
    public ResponseEntity<?> restablecer(@RequestBody Map<String, String> request) {
        try {
            String token = request.get("token");
            String password = request.get("nueva_password");
            usuarioService.restablecerPassword(token, password);
            return ResponseEntity.ok(Map.of("mensaje", "Contraseña actualizada correctamente con BCrypt"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * GET: /api/usuarios/perfil
     * Devuelve los datos del usuario logueado basándose en el Token JWT
     */
    @GetMapping("/perfil")
    public ResponseEntity<Usuario> obtenerPerfilPropio() {
        // 1. Extraemos el correo del contexto de seguridad (puesto ahí por el JwtRequestFilter)
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String email = auth.getName();

        // 2. Buscamos y devolvemos el usuario
        Usuario usuario = usuarioService.obtenerPerfil(email);
        return ResponseEntity.ok(usuario);
    }

}