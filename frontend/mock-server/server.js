const http = require("http");
const url = require("url");

const PORT = 9090;

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

function sampleResponse(unidadId) {
  const tramites = [
    {
      id: "T-1001",
      cliente_nombre: "Juan Pérez",
      cliente_email: "juan.perez@example.com",
      politica_nombre: "Registro Básico",
      prioridad: "normal",
      estado: "pendiente",
      nodo_actual_id: "N1",
      nodo_actual_nombre: "Inicio",
      semaforizacion: "Verde",
      fecha_limite: null,
      tiempo_restante_horas: 48,
      funcionario_asignado_nombre: "María López",
      fecha_inicio: new Date().toISOString(),
      progreso: 0,
    },
    {
      id: "T-1002",
      cliente_nombre: "Ana Gómez",
      cliente_email: "ana.gomez@example.com",
      politica_nombre: "Solicitud Avanzada",
      prioridad: "urgente",
      estado: "en_progreso",
      nodo_actual_id: "N3",
      nodo_actual_nombre: "Verificación",
      semaforizacion: "Rojo",
      fecha_limite: null,
      tiempo_restante_horas: 2,
      funcionario_asignado_nombre: null,
      fecha_inicio: new Date().toISOString(),
      progreso: 30,
    },
  ];

  return {
    total: tramites.length,
    pagina_actual: 1,
    total_paginas: 1,
    pendientes: tramites.filter((t) => t.estado === "pendiente").length,
    en_progreso: tramites.filter((t) => t.estado === "en_progreso").length,
    observados: tramites.filter((t) => t.estado === "observado").length,
    finalizados: tramites.filter((t) => t.estado === "finalizado").length,
    semaforizacion: {
      verde: tramites.filter((t) => t.semaforizacion === "Verde").length,
      amarillo: tramites.filter((t) => t.semaforizacion === "Amarillo").length,
      rojo: tramites.filter((t) => t.semaforizacion === "Rojo").length,
    },
    tramites,
  };
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  if (
    req.method === "GET" &&
    /^\/api\/tramites\/bandeja\/.+/.test(parsed.pathname)
  ) {
    const parts = parsed.pathname.split("/");
    const unidadId = parts[parts.length - 1];
    const resp = sampleResponse(unidadId);
    return sendJson(res, 200, resp);
  }

  // default
  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`Mock API server listening on http://localhost:${PORT}`);
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
