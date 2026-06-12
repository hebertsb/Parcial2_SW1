package com.nexusflow.nexusflowbackend.controller;

import com.nexusflow.nexusflowbackend.security.JwtUtil;
import com.nexusflow.nexusflowbackend.model.Usuario;
import com.nexusflow.nexusflowbackend.service.UsuarioService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Autowired
    private UsuarioService usuarioService;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private BCryptPasswordEncoder passwordEncoder;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> request) {
        String email = request.get("email") != null ? request.get("email").trim() : "";
        String password = request.get("password");

        Usuario usuario = usuarioService.buscarPorEmail(email)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        boolean isClaveValida = passwordEncoder.matches(password, usuario.getClave_hash());
        boolean isTokenValido = false;

        if (!isClaveValida && usuario.getToken_recuperacion() != null) {
            if (password.equals(usuario.getToken_recuperacion())) {
                if (usuario.getToken_expiracion() != null && usuario.getToken_expiracion().isAfter(java.time.LocalDateTime.now())) {
                    isTokenValido = true;
                }
            }
        }

        if (isClaveValida || isTokenValido) {
            String token = jwtUtil.generateToken(usuario);
            return ResponseEntity.ok(Map.of("token", token, "usuario", usuario));
        } else {
            return ResponseEntity.status(401).body("Contraseña incorrecta o token expirado");
        }
    }

    @PostMapping("/recuperar-password")
    public ResponseEntity<?> solicitarRecuperacion(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        try {
            String token = usuarioService.generarTokenRecuperacion(email);
            return ResponseEntity.ok(Map.of(
                "mensaje", "Se ha generado un token de recuperación. Revisa la consola o usa este token temporal.",
                "token_temporal", token
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/restablecer-password")
    public ResponseEntity<?> restablecerPassword(@RequestBody Map<String, String> request) {
        String token = request.get("token");
        String nuevaPassword = request.get("nuevaPassword");
        try {
            usuarioService.restablecerPassword(token, nuevaPassword);
            return ResponseEntity.ok(Map.of("mensaje", "Contraseña actualizada exitosamente"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/cambiar-password")
    public ResponseEntity<?> cambiarPassword(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String passwordActual = request.get("passwordActual");
        String nuevaPassword = request.get("nuevaPassword");
        try {
            usuarioService.cambiarPassword(email, passwordActual, nuevaPassword);
            return ResponseEntity.ok(Map.of("mensaje", "Contraseña actualizada exitosamente"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}