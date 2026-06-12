package com.nexusflow.nexusflowbackend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtRequestFilter extends OncePerRequestFilter {

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private CustomUserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        final String authorizationHeader = request.getHeader("Authorization");

        String username = null;
        String jwt = null;

        // 1. Extraer el JWT del Header
        if (authorizationHeader != null && authorizationHeader.startsWith("Bearer ")) {
            jwt = authorizationHeader.substring(7);
            try {
                username = jwtUtil.extractUsername(jwt);
            } catch (Exception e) {
                System.out.println("❌ ERROR: No se pudo extraer el usuario del token: " + e.getMessage());
            }
        }

        // 2. Validar el usuario y el contexto de seguridad
        if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {

            // Cargamos los detalles desde CustomUserDetailsService (donde pusimos el ROL-SUPER/ROL-ADMIN)
            UserDetails userDetails = this.userDetailsService.loadUserByUsername(username);

            if (jwtUtil.validateToken(jwt, userDetails.getUsername())) {

                // Creamos el token de autenticación incluyendo las authorities (roles)
                UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                        userDetails,
                        null,
                        userDetails.getAuthorities() // <--- CRITICO: Aquí se inyectan los permisos
                );

                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                // Autorizamos la petición en el contexto de Spring
                SecurityContextHolder.getContext().setAuthentication(authToken);

                // LOG DE DEPUREACIÓN PARA HEBERT
                System.out.println("✅ ACCESO CONCEDIDO: Usuario [" + username + "] con Roles: " + userDetails.getAuthorities());
            } else {
                System.out.println("⚠️ ADVERTENCIA: Token inválido para el usuario: " + username);
            }
        }

        // Continuar con la cadena de filtros
        chain.doFilter(request, response);
    }
}