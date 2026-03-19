import { resolveRealtimeCoreSession } from "../_lib/auth.js";
import { buildRealtimeCoreHeartbeat, buildRealtimeCoreSystemOverlay } from "../_lib/realtimeCore.js";

function sendEvent(res, event) {
  res.write(`id: ${event.id}\n`);
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
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

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "Método no permitido" }));
    return;
  }

  const session = resolveRealtimeCoreSession(req);
  if (!session) {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "Sesión no válida o vencida" }));
    return;
  }

  const intervalMs = Math.max(8_000, Math.min(15_000, Number(req.query?.intervalMs || 10_000) || 10_000));
  const closeAfterMs = Math.max(intervalMs * 2, 25_000);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

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
      const overlay = await buildRealtimeCoreSystemOverlay(req);
      sendEvent(res, createEvent("system.overlay.updated", "system", overlay));
      sendEvent(res, createEvent("system.heartbeat", "system", buildRealtimeCoreHeartbeat(overlay)));
    } catch (error) {
      sendEvent(res, createEvent("system.heartbeat", "system", {
        connected: false,
        generatedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : "No se pudo emitir overlay",
      }));
    }
  };

  res.write("retry: 1500\n\n");
  await emitOverlay();

  intervalId = setInterval(() => {
    void emitOverlay();
  }, intervalMs);

  timeoutId = setTimeout(() => {
    closeStream();
  }, closeAfterMs);
}
