import http from "node:http";
import { URL } from "node:url";
import {
  buildRealtimeCoreBootstrap,
  buildRealtimeCoreHeartbeat,
  buildRealtimeCoreSystemOverlay,
} from "../api/_lib/realtimeCore.js";
import { resolveRealtimeCoreSession } from "../api/_lib/auth.js";

const PORT = Number(process.env.REALTIME_CORE_PORT || 8787);
const HOST = process.env.REALTIME_CORE_HOST || "0.0.0.0";
const ALLOWED_ORIGIN = String(process.env.REALTIME_CORE_ALLOWED_ORIGIN || "").trim();

function setCorsHeaders(req, res) {
  const origin = String(req.headers.origin || "");
  if (!ALLOWED_ORIGIN || !origin || origin !== ALLOWED_ORIGIN) return;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Vary", "Origin");
}

function sendJson(req, res, status, body) {
  setCorsHeaders(req, res);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function normalizeRequest(req, url) {
  const query = Object.fromEntries(url.searchParams.entries());
  return {
    headers: req.headers,
    query,
  };
}

function createEvent(type, channel, payload) {
  return {
    id: `${type}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    type,
    channel,
    createdAt: new Date().toISOString(),
    payload,
  };
}

function writeEvent(res, event) {
  res.write(`id: ${event.id}\n`);
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

async function handleBootstrap(req, res, url) {
  const normalizedReq = normalizeRequest(req, url);
  const session = resolveRealtimeCoreSession(normalizedReq);
  if (!session) {
    sendJson(req, res, 401, { message: "Sesión no válida o vencida" });
    return;
  }
  const payload = await buildRealtimeCoreBootstrap(normalizedReq);
  sendJson(req, res, 200, payload);
}

async function handleEvents(req, res, url) {
  const normalizedReq = normalizeRequest(req, url);
  const session = resolveRealtimeCoreSession(normalizedReq);
  if (!session) {
    sendJson(req, res, 401, { message: "Sesión no válida o vencida" });
    return;
  }

  const intervalMs = Math.max(8_000, Math.min(15_000, Number(url.searchParams.get("intervalMs") || 10_000) || 10_000));
  const closeAfterMs = Math.max(intervalMs * 2, 25_000);

  setCorsHeaders(req, res);
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 1500\n\n");

  let closed = false;
  let intervalId = null;
  let timeoutId = null;

  const closeStream = () => {
    if (closed) return;
    closed = true;
    if (intervalId) clearInterval(intervalId);
    if (timeoutId) clearTimeout(timeoutId);
    res.end();
  };

  req.on("close", closeStream);
  req.on("aborted", closeStream);

  const emitOverlay = async () => {
    try {
      const overlay = await buildRealtimeCoreSystemOverlay(normalizedReq);
      writeEvent(res, createEvent("system.overlay.updated", "system", overlay));
      writeEvent(res, createEvent("system.heartbeat", "system", buildRealtimeCoreHeartbeat(overlay)));
    } catch (error) {
      writeEvent(res, createEvent("system.heartbeat", "system", {
        connected: false,
        generatedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : "No se pudo emitir overlay",
      }));
    }
  };

  await emitOverlay();
  intervalId = setInterval(() => {
    void emitOverlay();
  }, intervalMs);
  timeoutId = setTimeout(closeStream, closeAfterMs);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "OPTIONS") {
    setCorsHeaders(req, res);
    res.writeHead(204, {
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(req, res, 200, {
        ok: true,
        service: "realtime-core",
        now: new Date().toISOString(),
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/bootstrap") {
      await handleBootstrap(req, res, url);
      return;
    }

    if (req.method === "GET" && url.pathname === "/events") {
      await handleEvents(req, res, url);
      return;
    }

    sendJson(req, res, 404, { message: "Ruta no encontrada" });
  } catch (error) {
    sendJson(req, res, 500, {
      message: error instanceof Error ? error.message : "No se pudo responder desde realtime core",
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[realtime-core] listening on http://${HOST}:${PORT}`);
});
