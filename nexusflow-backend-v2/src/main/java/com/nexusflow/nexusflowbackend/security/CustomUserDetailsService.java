package com.nexusflow.nexusflowbackend.security;

import com.nexusflow.nexusflowbackend.model.Usuario;
import com.nexusflow.nexusflowbackend.service.UsuarioService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    @Autowired
    private UsuarioService usuarioService;

    @Override
    public UserDetails loadUserByUsername(String identifier) throws UsernameNotFoundException {
        // Buscamos primero por email, si no lo encuentra, buscamos por ID
        Usuario usuario = usuarioService.buscarPorEmail(identifier)
                .orElseGet(() -> usuarioService.obtenerPorId(identifier)
                        .orElseThrow(() -> new UsernameNotFoundException("Usuario no encontrado: " + identifier)));

        // Extraer authority: prioridad 1: nombre_rol en rol_detalle (ej: "ADMIN_EMPRESA")
        //                    prioridad 2: rol_id directo del usuario (ej: ObjectId del rol)
        //                    prioridad 3: "USUARIO" genérico (NO "INVITADO" que podría causar confusión)
        String authority = "USUARIO";
        if (usuario.getRol_detalle() != null && usuario.getRol_detalle().containsKey("nombre_rol")) {
            Object nombreRol = usuario.getRol_detalle().get("nombre_rol");
            if (nombreRol != null && !nombreRol.toString().isBlank()) {
                authority = nombreRol.toString();
            }
        } else if (usuario.getRol_id() != null && !usuario.getRol_id().isBlank()) {
            authority = usuario.getRol_id();
        }

        System.out.println("🔐 AUTH: Usuario [" + identifier + "] → Authority asignada: [" + authority + "]");

        return org.springframework.security.core.userdetails.User
                .withUsername(usuario.getId()) // El "Username" para Spring será el ID
                .password(usuario.getClave_hash())
                .authorities(authority)
                .build();
    }
}