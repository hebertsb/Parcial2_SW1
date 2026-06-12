# ============================================================
# NexusFlow Backend — Dockerfile (Spring Boot 3.2.5 / Java 17)
# Build multi-stage: Maven build + JRE runtime
# ============================================================

# ---- Stage 1: Build con Maven ----
FROM eclipse-temurin:17-jdk-alpine AS build

WORKDIR /app

# Copiar archivos de dependencias primero (cache layer)
COPY pom.xml .
COPY .mvn .mvn
COPY mvnw .
RUN chmod +x mvnw

# Descargar dependencias (se cachea si pom.xml no cambia)
RUN ./mvnw dependency:go-offline -B

# Copiar código fuente y compilar
COPY src src
RUN ./mvnw package -DskipTests -B

# ---- Stage 2: Runtime con JRE slim ----
FROM eclipse-temurin:17-jre-alpine AS runtime

LABEL maintainer="Equipo NexusFlow"
LABEL description="NexusFlow Backend - Spring Boot 3.2.5"

WORKDIR /app

# Crear directorio para evidencias
RUN mkdir -p /app/evidencias

# Crear usuario no-root por seguridad
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

# Copiar el JAR desde la etapa de build
COPY --from=build /app/target/*.jar app.jar

# Puerto del servidor Spring Boot
EXPOSE 9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget -qO- http://localhost:9090/actuator/health || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
