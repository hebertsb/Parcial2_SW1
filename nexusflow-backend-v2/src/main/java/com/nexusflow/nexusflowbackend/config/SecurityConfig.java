package com.nexusflow.nexusflowbackend.config;

import com.nexusflow.nexusflowbackend.security.JwtRequestFilter;
import com.nexusflow.nexusflowbackend.service.UsuarioService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import java.util.Arrays;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Value("${ALLOWED_ORIGINS:http://localhost:4200,http://localhost:3000}")
    private String allowedOrigins;

    @Autowired
    private JwtRequestFilter jwtRequestFilter;

    @Autowired
    private UsuarioService usuarioService;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // 1. Rutas Públicas y WebSockets
                        .requestMatchers("/api/auth/**", "/api/usuarios/registrar", "/api/usuarios/login").permitAll()
                        .requestMatchers("/api/usuarios/recuperar-password", "/api/usuarios/restablecer-password").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/empresas").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/empresas").permitAll()
                        .requestMatchers("/ws/**", "/ws-notificaciones/**", "/ws-stomp/**", "/ws-stomp").permitAll()
                        // Web Push — vapid key is public; subscribe/notify require valid session (browser sends with credentials)
                        .requestMatchers(HttpMethod.GET, "/api/push/vapid-key").permitAll()
                        .requestMatchers("/api/push/**").permitAll()
                        // Consulta pública de trámite (familiares/visitantes, sin JWT)
                        .requestMatchers(HttpMethod.GET, "/api/tramites/*/consulta-publica").permitAll()

                        // 2. Seguridad para Roles (CU-05) - Sincronizado con ROL-SUPER y ROL-ADMIN
                        // Cualquier usuario logueado puede VER la lista de roles
                        .requestMatchers(HttpMethod.GET, "/api/roles/**").authenticated()

                        // Solo los niveles superiores pueden CREAR, EDITAR o ELIMINAR roles y usuarios
                        .requestMatchers(HttpMethod.POST, "/api/usuarios").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/roles/**").hasAnyAuthority("ROL-SUPER", "ROL-ADMIN", "ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/roles/**").hasAnyAuthority("ROL-SUPER", "ROL-ADMIN", "ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/roles/**").hasAnyAuthority("ROL-SUPER", "ROL-ADMIN", "ADMIN")

                        // 3. Seguridad para Políticas y Formularios (CU-09, CU-10, CU-11)
                        // Cualquier usuario autenticado puede acceder (Admin, DISEÑADOR_PROCESOS, etc.)
                        // El control de permisos granulares se gestiona en el frontend.
                        .requestMatchers("/api/politicas/**", "/api/formularios/**").authenticated()

                        // 4. Seguridad para Empresas y el resto del sistema
                        .requestMatchers("/api/empresas/**").authenticated()
                        .anyRequest().authenticated()
                );

        http.addFilterBefore(jwtRequestFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.addAllowedOriginPattern("*");
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        configuration.addAllowedHeader("*");
        configuration.addExposedHeader("Authorization");
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}