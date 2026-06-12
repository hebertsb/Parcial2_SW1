# ============================================================
# NexusFlow Frontend — Dockerfile (Angular 18 + nginx)
# Build multi-stage: Node build + nginx servidor estático
# ============================================================

# ---- Stage 1: Build Angular ----
FROM node:18-alpine AS build

WORKDIR /app

# Copiar archivos de dependencias primero (cache layer)
COPY package.json ./
RUN npm install --legacy-peer-deps

# Copiar código fuente y compilar para producción
COPY . .
RUN npm run build

# ---- Stage 2: Servidor nginx ----
FROM nginx:alpine AS runtime

LABEL maintainer="Equipo NexusFlow"
LABEL description="NexusFlow Frontend - Angular 18"

# Copiar el build de Angular al servidor nginx
COPY --from=build /app/dist/architect-app /usr/share/nginx/html

# Copiar configuración nginx personalizada para Angular SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:80 || exit 1

CMD ["nginx", "-g", "daemon off;"]
