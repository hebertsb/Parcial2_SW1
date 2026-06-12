package com.nexusflow.nexusflowbackend.service;

import com.nexusflow.nexusflowbackend.model.Rol;
import com.nexusflow.nexusflowbackend.model.Usuario;
import com.nexusflow.nexusflowbackend.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;


import java.time.LocalDateTime;
import java.util.*;

@Service
public class UsuarioService {

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private BCryptPasswordEncoder passwordEncoder; // <--- Inyectamos el encriptador

    @Autowired
    private RolService rolService;

    @Autowired
    private org.springframework.mail.javamail.JavaMailSender mailSender;

    /**
     * Obtener todos los usuarios del sistema.
     * Útil para la vista de SuperAdmin.
     */
    public List<Usuario> obtenerTodos() {
        return usuarioRepository.findAll();
    }

    /**
     * BUSCAR POR EMAIL - robusto: devuelve el primer match sin lanzar excepción si hay duplicados.
     * Usa findAll+stream para evitar el "non unique result" de Spring Data.
     */
    public Optional<Usuario> buscarPorEmail(String email) {
        if (email == null || email.isBlank()) return Optional.empty();
        return usuarioRepository.findAll().stream()
                .filter(u -> email.equalsIgnoreCase(u.getCorreo_electronico()))
                .findFirst();
    }

    // El resto del código se mantiene IGUAL
    public Optional<Usuario> obtenerPorId(String id) {
        return usuarioRepository.findById(id);
    }

    /**
     * CU-01: Guardar/Registrar un nuevo usuario.
     */
    public Usuario guardar(Usuario usuario) {
        // 1. Validación de duplicados
        Optional<Usuario> existente = buscarPorEmail(usuario.getCorreo_electronico());
        if (existente.isPresent() && usuario.getId() == null) {
            throw new RuntimeException("El correo electrónico ya está registrado");
        }

        // 2. LÓGICA DEL SELECTOR: Validar que el Rol exista y heredar sus permisos
        if (usuario.getRol_id() != null) {
            Rol rolEncontrado = rolService.obtenerPorId(usuario.getRol_id())
                    .orElseThrow(() -> new RuntimeException("El Rol seleccionado no es válido"));

            // Sincronizamos el rol_detalle (Capa de Transformación NoSQL)
            // Guardamos una copia de los permisos en el usuario para que el sistema sea más rápido
            Map<String, Object> detalle = new HashMap<>();
            detalle.put("nombre_rol", rolEncontrado.getNombre_rol());
            detalle.put("permisos", rolEncontrado.getPermisos());
            usuario.setRol_detalle(detalle);
        }

        // 3. Seguridad y Activación
        if (usuario.getId() == null) {
            usuario.setClave_hash(passwordEncoder.encode(usuario.getClave_hash()));
        }
        if (!usuario.isEsta_activo()) {
            usuario.setEsta_activo(true);
        }

        // 4. Empresa por defecto — evita usuarios huérfanos sin empresa
        if (usuario.getEmpresa_id() == null || usuario.getEmpresa_id().isBlank()) {
            boolean esSuper = "ROL-SUPER".equals(usuario.getRol_id());
            if (!esSuper) {
                usuario.setEmpresa_id("EMP-001");
            }
        }

        return usuarioRepository.save(usuario);
    }

    /**
     * CU-02: Genera un token único para recuperación de contraseña y lo envía por email.
     */
    public String generarTokenRecuperacion(String email) {
        Usuario usuario = buscarPorEmail(email)
                .orElseThrow(() -> new RuntimeException("No existe un usuario con ese correo"));

        // Generamos un código único temporal (corto para que sea fácil de copiar)
        String token = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        usuario.setToken_recuperacion(token);

        // El token expira en 1 hora
        usuario.setToken_expiracion(LocalDateTime.now().plusHours(1));

        usuarioRepository.save(usuario);

        // Enviar Correo
        try {
            org.springframework.mail.SimpleMailMessage mensaje = new org.springframework.mail.SimpleMailMessage();
            mensaje.setTo(email);
            mensaje.setSubject("NexusFlow - Recuperación de Contraseña");
            mensaje.setText("Hola " + usuario.getNombre_completo() + ",\n\n" +
                    "Has solicitado restablecer tu contraseña. Utiliza el siguiente TOKEN TEMPORAL para ingresar una nueva contraseña en tu perfil:\n\n" +
                    "TOKEN: " + token + "\n\n" +
                    "Este token expirará en 1 hora.\n\n" +
                    "Atentamente,\nEl Equipo de NexusFlow");
            
            mailSender.send(mensaje);
            System.out.println("LOG: Correo enviado exitosamente a " + email);
        } catch (Exception e) {
            System.out.println("ERROR: No se pudo enviar el correo a " + email + ". Detalles: " + e.getMessage());
            throw new RuntimeException("Error al enviar el correo. Por favor intenta más tarde.");
        }

        return token;
    }

    /**
     * CU-02: Valida el token y cambia la contraseña.
     * IMPORTANTE: Encripta la nueva contraseña antes de persistir.
     */
    public void restablecerPassword(String token, String nuevaPassword) {
        // Buscamos al usuario que tenga ese token específico
        Usuario usuario = usuarioRepository.findAll().stream()
                .filter(u -> token.equals(u.getToken_recuperacion()))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Token de recuperación inválido o ya utilizado"));

        // Validamos si el token no ha expirado comparando con la hora actual
        if (usuario.getToken_expiracion().isBefore(LocalDateTime.now())) {
            throw new RuntimeException("El token ha expirado. Solicite uno nuevo.");
        }

        // Encriptamos la nueva contraseña (BCrypt)
        usuario.setClave_hash(passwordEncoder.encode(nuevaPassword));

        // Limpiamos los campos de recuperación para que el token sea de un solo uso
        usuario.setToken_recuperacion(null);
        usuario.setToken_expiracion(null);

        usuarioRepository.save(usuario);
    }

    /**
     * CU-02: Cambiar contraseña usando la contraseña actual o el token temporal.
     */
    public void cambiarPassword(String email, String passwordActual, String nuevaPassword) {
        Usuario usuario = buscarPorEmail(email)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        boolean esPasswordCorrecta = passwordEncoder.matches(passwordActual, usuario.getClave_hash());
        boolean esTokenCorrecto = passwordActual.equals(usuario.getToken_recuperacion()) &&
                                  usuario.getToken_expiracion() != null &&
                                  usuario.getToken_expiracion().isAfter(LocalDateTime.now());

        if (!esPasswordCorrecta && !esTokenCorrecto) {
            throw new RuntimeException("La contraseña actual o token es incorrecto/ha expirado.");
        }

        usuario.setClave_hash(passwordEncoder.encode(nuevaPassword));
        usuario.setToken_recuperacion(null);
        usuario.setToken_expiracion(null);
        usuarioRepository.save(usuario);
    }

    /**
     * Obtener usuarios por empresa (Multi-tenant).
     */
    public List<Usuario> obtenerPorEmpresa(String empresaId) {
        return usuarioRepository.findAll().stream()
                .filter(u -> u.getEmpresa_id() != null && u.getEmpresa_id().equals(empresaId))
                .toList();
    }

    /**
     * CU-01: Actualizar datos del usuario
     */
    public Usuario actualizar(String id, Usuario detalles) {
        Usuario usuario = usuarioRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        // Validar que el nuevo correo no esté en uso por OTRO usuario
        String nuevoEmail = detalles.getCorreo_electronico();
        if (nuevoEmail != null && !nuevoEmail.equalsIgnoreCase(usuario.getCorreo_electronico())) {
            boolean emailEnUso = usuarioRepository.findAll().stream()
                    .anyMatch(u -> nuevoEmail.equalsIgnoreCase(u.getCorreo_electronico()) && !u.getId().equals(id));
            if (emailEnUso) {
                throw new RuntimeException("El correo '" + nuevoEmail + "' ya está en uso por otro usuario.");
            }
        }

        usuario.setNombre_completo(detalles.getNombre_completo());
        usuario.setCorreo_electronico(nuevoEmail);
        usuario.setTelefono(detalles.getTelefono());
        usuario.setSexo(detalles.getSexo());
        usuario.setUnidad_id(detalles.getUnidad_id());
        usuario.setRol_id(detalles.getRol_id());
        usuario.setEsta_activo(detalles.isEsta_activo());

        // Re-sincronizar rol_detalle si el rol cambió
        if (detalles.getRol_id() != null) {
            rolService.obtenerPorId(detalles.getRol_id()).ifPresent(rol -> {
                Map<String, Object> detalle = new HashMap<>();
                detalle.put("nombre_rol", rol.getNombre_rol());
                detalle.put("permisos", rol.getPermisos());
                usuario.setRol_detalle(detalle);
            });
        }

        if (detalles.getClave_hash() != null && !detalles.getClave_hash().isEmpty()) {
            usuario.setClave_hash(passwordEncoder.encode(detalles.getClave_hash()));
        }

        return usuarioRepository.save(usuario);
    }


    /**
     * CU-01: Baja Lógica
     */
    public void desactivar(String id) {
        Usuario usuario = usuarioRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        usuario.setEsta_activo(false);
        usuarioRepository.save(usuario);
    }

    /**
     * Obtener perfil completo del usuario actual
     */
    public Usuario obtenerPerfil(String email) {
        return buscarPorEmail(email)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
    }



}