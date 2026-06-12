package com.nexusflow.nexusflowbackend;

import com.nexusflow.nexusflowbackend.model.*;
import com.nexusflow.nexusflowbackend.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableScheduling;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import jakarta.annotation.PostConstruct;
import java.util.TimeZone;

@SpringBootApplication
@EnableScheduling
public class NexusflowBackendV2Application {

    public static void main(String[] args) {
        SpringApplication.run(NexusflowBackendV2Application.class, args);
    }

    @PostConstruct
    public void init() {
        TimeZone.setDefault(TimeZone.getTimeZone("GMT-4"));
        System.out.println("🌍 Zona horaria configurada: GMT-4 (Bolivia)");
    }

    @Bean
    CommandLineRunner initDatabase(
            UsuarioRepository userRepo,
            EmpresaRepository empresaRepo,
            RolRepository rolRepo,
            UnidadOrganizacionalRepository unidadRepo,
            PoliticaRepository politicaRepo,
            FormularioNodoRepository nodoRepo
    ) {
        return args -> {
            System.out.println("🔍 Verificando datos base en nexusflow_oficial...");

            // --- LÍNEA DE DEBUG: Esto te dirá la verdad en la consola ---
            long conteoRoles = rolRepo.count();
            System.out.println("📊 Roles detectados actualmente en DB: " + conteoRoles);

            // 1. ROLES BASE
            if (!rolRepo.existsById("ROL-SUPER")) {
                Rol rolSuper = new Rol();
                rolSuper.setId("ROL-SUPER");
                rolSuper.setNombre_rol("SUPER_ADMIN");
                Map<String, Boolean> permisosSuper = new HashMap<>();
                permisosSuper.put("TODO_EL_SISTEMA", true);
                rolSuper.setPermisos(permisosSuper);
                rolRepo.save(rolSuper);
                System.out.println("✅ Rol SuperAdmin creado.");
            }

            // 3.---  ROL ADMIN EMPRESA ---
            if (!rolRepo.existsById("ROL-ADMIN")) {
                Rol rolAdmin = new Rol();
                rolAdmin.setId("ROL-ADMIN");
                rolAdmin.setNombre_rol("ADMIN_EMPRESA");
                Map<String, Boolean> permisosAdmin = new HashMap<>();
                permisosAdmin.put("GESTION_USUARIOS", true);
                permisosAdmin.put("GESTION_POLITICAS", true);
                rolAdmin.setPermisos(permisosAdmin);
                rolRepo.save(rolAdmin);
                System.out.println("✅ Rol Admin Empresa creado.");
            }

            // 4. ROL DISEÑADOR
            if (!rolRepo.existsById("ROL-DISEÑADOR")) {
                Rol rolDiseno = new Rol();
                rolDiseno.setId("ROL-DISEÑADOR");
                rolDiseno.setNombre_rol("DISEÑADOR_PROCESOS");
                Map<String, Boolean> permisosDiseno = new HashMap<>();
                permisosDiseno.put("DISENO_WORKFLOW", true);
                permisosDiseno.put("GESTION_FORMULARIOS", true);
                rolDiseno.setPermisos(permisosDiseno);
                rolRepo.save(rolDiseno);
                System.out.println("✅ Rol Diseñador creado.");
            }

            // 5. ROL FUNCIONARIO
            if (!rolRepo.existsById("ROL-FUNCIONARIO")) {
                Rol rolFunc = new Rol();
                rolFunc.setId("ROL-FUNCIONARIO");
                rolFunc.setNombre_rol("FUNCIONARIO_OPERATIVO");
                Map<String, Boolean> permisosFunc = new HashMap<>();
                permisosFunc.put("VER_FORMULARIO", true);
                permisosFunc.put("EDITAR_FORMULARIO", true);
                permisosFunc.put("EDITAR_EN_REVISION", true);
                permisosFunc.put("RECIBIR_NOTIFICACIONES", true);
                permisosFunc.put("VER_USUARIOS", true);
                rolFunc.setPermisos(permisosFunc);
                rolRepo.save(rolFunc);
                System.out.println("✅ Rol Funcionario creado.");
            }

            // 7. ROL CLIENTE (Titular) - ¡AHORA FUERA DE LA POLÍTICA!
            if (!rolRepo.existsById("ROL-CLIENTE")) {
                Rol rolCli = new Rol();
                rolCli.setId("ROL-CLIENTE");
                rolCli.setNombre_rol("CLIENTE_TITULAR");
                Map<String, Boolean> permisosCli = new HashMap<>();
                permisosCli.put("VER_FORMULARIO", true);
                permisosCli.put("EDITAR_FORMULARIO", false);
                permisosCli.put("VER_ESTADO_SOLO", true);
                permisosCli.put("SUBIR_DOCUMENTOS", true);
                permisosCli.put("INICIAR_TRAMITE", true);
                rolCli.setPermisos(permisosCli);
                rolRepo.save(rolCli);
                System.out.println("✅ Rol Cliente creado.");
            }

            // 8. ROL VISITANTE (Familiar) - ¡AHORA FUERA DE LA POLÍTICA!
            if (!rolRepo.existsById("ROL-VISITANTE")) {
                Rol rolVis = new Rol();
                rolVis.setId("ROL-VISITANTE");
                rolVis.setNombre_rol("CLIENTE_VISITANTE");
                Map<String, Boolean> permisosVis = new HashMap<>();
                permisosVis.put("SOLO_LECTURA", true);
                rolVis.setPermisos(permisosVis);
                rolRepo.save(rolVis);
                System.out.println("✅ Rol Visitante creado.");
            }

            // 2. EMPRESA BASE
            if (!empresaRepo.existsById("EMP-001")) {
                Empresa nexus = new Empresa();
                nexus.setId("EMP-001");
                nexus.setNombre_legal("NexusFlow Soluciones Bolivia S.A.");
                nexus.setNit("354678021");
                nexus.setEstado("ACTIVO");
                nexus.setPlan_suscripcion("ENTERPRISE");
                nexus.setFecha_registro(LocalDateTime.now());
                empresaRepo.save(nexus);
                System.out.println("✅ Empresa base creada.");
            }

            // 3. USUARIO MAESTRO
            if (!userRepo.existsById("USR-MASTER")) {
                Usuario superUser = new Usuario();
                superUser.setId("USR-MASTER");
                superUser.setNombre_completo("Administrador Maestro");
                superUser.setCorreo_electronico("superAdmin@gmail.com");
                superUser.setClave_hash("$2a$10$8.UnVuG9HHgffUDAlk8KnOQ5lAGHWokgeWCuQXv.X7.dfS5tI8qiq");
                superUser.setEsta_activo(true);
                superUser.setRol_id("ROL-SUPER");
                userRepo.save(superUser);
                System.out.println("✅ Usuario maestro creado.");
            }

            // 6. POLÍTICA Y NODOS BASE CON ESTRUCTURA UML 2.5 (CU-09)
            if (!politicaRepo.existsById("POL-CREDITO")) {
                Politica politicaCredito = new Politica();
                politicaCredito.setId("POL-CREDITO");
                politicaCredito.setNombre("Crédito Vehicular");
                politicaCredito.setTipo_flujo("SECUENCIAL");
                politicaCredito.setEsta_activa(true);
                politicaCredito.setEmpresa_id("EMP-001");

                // Construimos el esquema profesional para que el ExportService tenga qué leer
                Map<String, Object> esquema = new HashMap<>();
                esquema.put("version", "2.0");

                // Definimos los enlaces (Las flechas que EA va a dibujar)
                List<Map<String, String>> enlaces = List.of(
                        Map.of("from", "START_NODE", "to", "NODO_INICIO"),
                        Map.of("from", "NODO_INICIO", "to", "DECISION_01"),
                        Map.of("from", "DECISION_01", "to", "END_NODE")
                );
                esquema.put("enlaces", enlaces);

                politicaCredito.setEsquema_workflow(esquema);
                politicaRepo.save(politicaCredito);

                // Creamos los documentos de Formulario_Nodo correspondientes
                // Nodo de Inicio (El punto negro ●)
                Formulario_Nodo start = new Formulario_Nodo();
                start.setId("START-001");
                start.setId_nodo("START_NODE");
                start.setNombre_nodo("Inicio");
                start.setTipo_nodo("NODO_INICIO");
                start.setPolitica_id("POL-CREDITO");
                nodoRepo.save(start);

                // Tu nodo de registro actual
                Formulario_Nodo nodo1 = new Formulario_Nodo();
                nodo1.setId("NODO-001");
                nodo1.setId_nodo("NODO_INICIO");
                nodo1.setNombre_nodo("Registro de Solicitud");
                nodo1.setTipo_nodo("TASK");
                nodo1.setPolitica_id("POL-CREDITO");
                nodoRepo.save(nodo1);

                // Nodo de Fin (El punto con borde ⚫)
                Formulario_Nodo end = new Formulario_Nodo();
                end.setId("END-001");
                end.setId_nodo("END_NODE");
                end.setNombre_nodo("Fin del Trámite");
                end.setTipo_nodo("NODO_FIN");
                end.setPolitica_id("POL-CREDITO");
                nodoRepo.save(end);

                System.out.println("✅ Política Pro UML 2.5 creada con éxito.");
            }

            System.out.println("\n====================================================");
            System.out.println("💎 MOTOR NEXUSFLOW LISTO - PERSISTENCIA ACTIVA");
            System.out.println("====================================================\n");
        };
    }
}