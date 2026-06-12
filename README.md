# NexusFlow-AI

NexusFlow-AI es un monorepo para gestión de flujos de trabajo empresariales con inteligencia artificial. El sistema combina un backend en Spring Boot, un microservicio de IA en FastAPI y un frontend en Angular para cubrir autenticación, diseño de políticas, ejecución de trámites, notificaciones, analítica y funciones asistidas por IA.

## Arquitectura

El repositorio está organizado en cuatro piezas principales:

- Backend principal en Spring Boot 3.2.5 sobre Java 17, con API REST, WebSocket, JWT, MongoDB, correo, PlantUML, Graphviz y notificaciones push.
- Microservicio de IA en FastAPI para diagramas, voz, analítica, asistente contextual, aprendizaje predictivo, reportes dinámicos, documentos S3/MinIO y herramientas de sistema.
- Frontend en Angular 18 con rutas por rol para superadmin, admin, diseñador, funcionario y cliente.
- Orquestación local con Docker Compose, MongoDB, OnlyOffice y MinIO.

## Funcionalidades principales

- Autenticación y recuperación de contraseña.
- Gestión de empresas, usuarios, roles y unidades.
- Creación y administración de políticas de negocio.
- Editor visual de flujos y formularios dinámicos.
- Inicio, seguimiento y ejecución de trámites.
- Bandeja de trabajo para funcionarios.
- Notificaciones en tiempo real y Web Push.
- Asistencia por IA para diagramas, voz, clasificación y reportes.
- Analítica de cuellos de botella y sugerencias de reasignación.
- Motor de aprendizaje con scikit-learn y TensorFlow.
- Gestión documental con S3/MinIO y colaboración con OnlyOffice.

## Tecnologías

| Capa            | Tecnología                                                             |
| --------------- | ---------------------------------------------------------------------- |
| Backend         | Spring Boot 3.2.5, Java 17, MongoDB, JWT, WebSocket, Mail              |
| IA              | FastAPI, Python 3.11+, OpenAI, scikit-learn, TensorFlow, pandas, NumPy |
| Frontend        | Angular 18, TypeScript, RxJS, Tailwind CSS, Foblex Flow, JointJS       |
| Infraestructura | Docker, Docker Compose, MongoDB 7, MinIO, OnlyOffice                   |

## Estructura del repositorio

```text
NexusFlow-AI/
├── README.md
├── .env.example
├── docker-compose.yml
├── FastApi/
│   ├── app/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   ├── Dockerfile
│   └── nginx.conf
└── nexusflow-backend-v2/
    ├── src/
    ├── Dockerfile
    └── pom.xml
```

## Requisitos

| Herramienta    | Versión recomendada              |
| -------------- | -------------------------------- |
| Java JDK       | 17                               |
| Maven          | 3.9+ o Maven Wrapper             |
| Node.js        | 18+                              |
| Python         | 3.11+                            |
| Docker Desktop | 24+                              |
| Git            | Cualquiera                       |
| MongoDB        | 7.0, solo si ejecutas sin Docker |

## Ejecución local sin Docker

### 1. Backend Spring Boot

```bash
cd nexusflow-backend-v2

# Windows
mvnw.cmd spring-boot:run

# Linux / Mac
./mvnw spring-boot:run
```

El backend se expone en `http://localhost:9090`.

### 2. Microservicio FastAPI

```bash
cd FastApi

python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

El servicio de IA se expone en `http://localhost:8000`.

### 3. Frontend Angular

```bash
cd frontend
npm install
npm start
```

El frontend de desarrollo se expone en `http://localhost:3000`.

## Ejecución con Docker

1. Copia la plantilla de variables de entorno:

```bash
cp .env.example .env
```

2. Completa los valores reales en `.env`.

3. Levanta todo el entorno:

```bash
docker-compose up --build
```

### Servicios y puertos

| Servicio            | Puerto |
| ------------------- | ------ |
| Frontend Angular    | 80     |
| Backend Spring Boot | 9090   |
| FastAPI             | 8000   |
| MongoDB             | 27017  |
| OnlyOffice          | 8080   |
| MinIO API           | 9000   |
| MinIO Console       | 9001   |

### Comandos útiles

```bash
docker-compose logs -f
docker-compose logs -f spring-backend
docker-compose ps
docker-compose down
docker-compose down -v
```

## Variables de entorno

Las variables usadas por Docker y los servicios están definidas en `.env.example`.

| Variable           | Servicio              | Uso                                  |
| ------------------ | --------------------- | ------------------------------------ |
| `JWT_SECRET`       | Spring Boot           | Firma de tokens JWT                  |
| `MAIL_USERNAME`    | Spring Boot           | Cuenta remitente de correo           |
| `MAIL_PASSWORD`    | Spring Boot           | App password de correo               |
| `MONGODB_URI`      | Spring Boot / FastAPI | Conexión a MongoDB                   |
| `MONGODB_DATABASE` | FastAPI               | Base de datos activa                 |
| `ALLOWED_ORIGINS`  | Spring Boot           | Orígenes permitidos para CORS        |
| `OPENAI_API_KEY`   | FastAPI               | Acceso a OpenAI o compatibilidad API |
| `OPENAI_BASE_URL`  | FastAPI               | Base URL del proveedor de IA         |
| `OPENAI_MODEL`     | FastAPI               | Modelo de texto para IA              |
| `WHISPER_MODEL`    | FastAPI               | Modelo de voz                        |
| `CORS_ORIGINS`     | FastAPI               | Orígenes permitidos                  |
| `AI_MODE`          | FastAPI               | `api` o `local`                      |

## Rutas principales del frontend

- `/login`
- `/consulta-tramite`
- `/tramites/:id/comprobante`
- `/superadmin/dashboard`
- `/admin/dashboard`
- `/admin/gestion-personal`
- `/admin/politicas`
- `/admin/ia-dashboard`
- `/admin/agente-reportes`
- `/designer/flow-editor/:politicaId`
- `/employee/inbox`
- `/client/dashboard`
- `/tramites/:id/ejecutar`
- `/tramites/:id/detalle`
- `/profile`
- `/notif-doc`

## Endpoints principales del backend Spring Boot

### Autenticación

- `POST /api/auth/login`
- `POST /api/auth/recuperar-password`
- `POST /api/auth/restablecer-password`
- `POST /api/auth/cambiar-password`

### Gestión base

- `GET /api/empresas`
- `POST /api/empresas`
- `POST /api/empresas/registrar-con-admin`
- `GET /api/usuarios`
- `POST /api/usuarios`
- `GET /api/roles`
- `GET /api/unidades`
- `GET /api/politicas`
- `GET /api/formularios`
- `GET /api/tramites`

### Trabajo y seguimiento

- `POST /api/tramites/iniciar`
- `POST /api/tramites/{id}/transicion`
- `GET /api/tramites/{id}/bitacora`
- `GET /api/tramites/bandeja/{unidadId}`
- `POST /api/notificaciones/solicitud-edicion`
- `GET /api/notificaciones/no-leidas`

### IA y analítica

- `POST /api/ia/generar-diagrama`
- `POST /api/ia/transcribir-voz`
- `GET /api/analytics/cuellos-botella/{empresaId}`
- `GET /api/dashboard/{empresaId}`
- `POST /api/voz/transcribir`
- `POST /api/push/subscribe`

### Exportación y utilidades

- `GET /api/workflow/exportar/{politicaId}`
- `GET /api/push/vapid-key`
- `GET /actuator/health`

## Endpoints principales de FastAPI

El microservicio de IA expone documentación interactiva en `http://localhost:8000/docs` y `http://localhost:8000/redoc`.

### Sistema

- `GET /`
- `GET /health`

### Diagramas y voz

- `POST /ia/generar-diagrama`
- `POST /ia/generar-y-guardar`
- `POST /ia/editar-diagrama/{politicaId}`
- `POST /voz/transcribir`

### Analítica y aprendizaje

- `POST /analytics/cuellos-botella`
- `POST /ia/...` para motor de aprendizaje predictivo
- `GET /tf/estado`

### Asistente, clasificación y reportes

- `POST /asistente/...`
- `POST /agente/clasificar`
- `GET /agente/listar/{empresa_id}`
- `GET /agente/estado`
- `POST /reportes/...`
- `GET /reportes/estado`

### Documentos y sistema en runtime

- `POST /documentos/...`
- `GET /documentos/...`
- `GET /sistema/modo-ia`
- `POST /sistema/modo-ia`

## Casos de uso cubiertos

| CU    | Caso de uso                 | Capa principal          |
| ----- | --------------------------- | ----------------------- |
| CU-01 | Iniciar sesión              | Spring Boot             |
| CU-02 | Recuperar contraseña        | Spring Boot             |
| CU-03 | Cerrar sesión               | Spring Boot             |
| CU-04 | Registrar empresa           | Spring Boot             |
| CU-05 | Gestionar usuarios y roles  | Spring Boot             |
| CU-06 | Gestionar unidades          | Spring Boot             |
| CU-07 | Asignar personal            | Spring Boot             |
| CU-08 | Crear políticas             | Spring Boot             |
| CU-09 | Modelado visual UML         | Spring Boot + Angular   |
| CU-10 | Reglas de decisión          | Spring Boot             |
| CU-11 | Formularios dinámicos       | Spring Boot             |
| CU-12 | Iniciar y seguir trámites   | Spring Boot             |
| CU-13 | Gestionar bandeja           | Spring Boot             |
| CU-14 | Ejecutar tareas             | Spring Boot             |
| CU-15 | Gestionar evidencias        | Spring Boot             |
| CU-16 | Notificaciones y alertas    | Spring Boot + WebSocket |
| CU-17 | Asistencia IA               | FastAPI                 |
| CU-18 | Registrar informes de voz   | FastAPI                 |
| CU-19 | Analizar cuellos de botella | FastAPI                 |
| CU-20 | Reportes y dashboard        | Spring Boot + FastAPI   |

## Comunicación entre servicios

```text
[Browser]
   └─ Angular :80 / :3000
        └─ Spring Boot :9090
              └─ FastAPI :8000
                    └─ IA externa / modelos locales

Servicios compartidos:
   ├─ MongoDB :27017
   ├─ OnlyOffice :8080
   └─ MinIO :9000 / 9001
```

En Docker Compose, la comunicación interna se resuelve por nombre de servicio:

- Angular -> Spring Boot: `http://spring-backend:9090`
- Spring Boot -> FastAPI: `http://fastapi-service:8000`
- Spring Boot y FastAPI -> MongoDB: `mongodb://mongodb:27017/nexusflow_oficial`

## Git y despliegue

Este repositorio ya está listo para un flujo de trabajo único en la raíz. Para subir cambios:

```bash
git add .
git commit -m "Actualizar README del proyecto"
git push origin main
```

## Notas

- El frontend usa routing por roles y carga diferida de componentes.
- El backend expone las rutas de negocio en español.
- El microservicio FastAPI incluye modo `api` y modo `local` para IA.
- Docker Compose también levanta OnlyOffice y MinIO para escenarios de colaboración y almacenamiento.
