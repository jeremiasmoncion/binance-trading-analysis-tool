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
const DEFAULT_POLL_INTERVAL_MS = Math.max(4_000, Number(process.env.REALTIME_CORE_POLL_INTERVAL_MS || 8_000));
const MAX_CHANNEL_IDLE_MS = Math.max(30_000, Number(process.env.REALTIME_CORE_MAX_CHANNEL_IDLE_MS || 90_000));

const overlayChannels = new Map();

function hasUsefulDashboardSummary(summary) {
  if (!summary || typeof summary !== "object") return false;
  const portfolioValue = Number(summary?.portfolio?.totalValue || 0);
  const topAssetsCount = Array.isArray(summary?.topAssets) ? summary.topAssets.length : 0;
  const recentOrdersCount = Array.isArray(summary?.execution?.recentOrders) ? summary.execution.recentOrders.length : 0;
  return portfolioValue > 0 || topAssetsCount > 0 || recentOrdersCount > 0;
}

function hasUsefulExecutionCenter(execution) {
  if (!execution || typeof execution !== "object") return false;
  const account = execution.account && typeof execution.account === "object" ? execution.account : {};
  const candidatesCount = Array.isArray(execution.candidates) ? execution.candidates.length : 0;
  const recentOrdersCount = Array.isArray(execution.recentOrders) ? execution.recentOrders.length : 0;
  const totalValue = Number(account.totalValue || 0);
  const cashValue = Number(account.cashValue || 0);
  const openOrdersCount = Number(account.openOrdersCount || 0);
  return totalValue > 0 || cashValue > 0 || openOrdersCount > 0 || candidatesCount > 0 || recentOrdersCount > 0;
}

function stabilizeOverlay(nextOverlay, previousOverlay) {
  if (!previousOverlay) return nextOverlay;

  const nextSummary = nextOverlay?.dashboardSummary ?? null;
  const previousSummary = previousOverlay?.dashboardSummary ?? null;
  const nextIsUseful = hasUsefulDashboardSummary(nextSummary);
  const previousIsUseful = hasUsefulDashboardSummary(previousSummary);
  const nextHasIssue = Boolean(nextSummary?.connectionIssue);

  if (previousIsUseful && (!nextIsUseful || nextHasIssue)) {
    nextOverlay = {
      ...nextOverlay,
      dashboardSummary: previousSummary,
    };
  } else if (nextSummary && previousSummary) {
    const nextTopAssets = Array.isArray(nextSummary.topAssets) ? nextSummary.topAssets : [];
    const previousTopAssets = Array.isArray(previousSummary.topAssets) ? previousSummary.topAssets : [];
    const previousPortfolio = previousSummary.portfolio || {};
    const nextPortfolio = nextSummary.portfolio || {};
    const previousPositionsValue = Number(previousPortfolio.positionsValue || 0);
    const nextPositionsValue = Number(nextPortfolio.positionsValue || 0);
    const previousTotalValue = Number(previousPortfolio.totalValue || 0);
    const nextTotalValue = Number(nextPortfolio.totalValue || 0);
    const nextCashValue = Number(nextPortfolio.cashValue || 0);
    const collapsedToMostlyCash = nextTotalValue > 0 && nextCashValue / nextTotalValue >= 0.9;
    const collapsedPositions = previousPositionsValue > 0 && nextPositionsValue <= previousPositionsValue * 0.25;
    const collapsedTotalValue = previousTotalValue > 0 && nextTotalValue <= previousTotalValue * 0.75;

    if (collapsedTotalValue && collapsedPositions && collapsedToMostlyCash) {
      nextOverlay = {
        ...nextOverlay,
        dashboardSummary: {
          ...nextSummary,
          portfolio: previousSummary.portfolio,
          topAssets: previousTopAssets,
        },
      };
      return nextOverlay;
    }

    // The live overlay can arrive with KPI totals but no top-assets collection.
    // Keep the last good list in-memory so dashboard revisit does not blank
    // the assets card between navigations or lighter refresh cycles.
    if (!nextTopAssets.length && previousTopAssets.length) {
      nextOverlay = {
        ...nextOverlay,
        dashboardSummary: {
          ...nextSummary,
          topAssets: previousTopAssets,
        },
      };
    }
  }

  const nextExecution = nextOverlay?.execution ?? null;
  const previousExecution = previousOverlay?.execution ?? null;
  const nextExecutionUseful = hasUsefulExecutionCenter(nextExecution);
  const previousExecutionUseful = hasUsefulExecutionCenter(previousExecution);

  if (previousExecutionUseful && !nextExecutionUseful) {
    nextOverlay = {
      ...nextOverlay,
      execution: previousExecution,
    };
  }

  return nextOverlay;
}

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

function getChannelKey(session) {
  return String(session?.username || "").trim().toLowerCase();
}

function isSessionExpired(session) {
  return !session?.exp || Date.now() > Number(session.exp);
}

function getSubscriberCount() {
  return Array.from(overlayChannels.values()).reduce((total, channel) => total + channel.subscribers.size, 0);
}

function getChannelStats() {
  return Array.from(overlayChannels.values()).map((channel) => ({
    key: channel.key,
    subscribers: channel.subscribers.size,
    active: channel.active,
    lastPublishedAt: channel.lastPublishedAt,
    lastAccessedAt: channel.lastAccessedAt,
    lastError: channel.lastError,
  }));
}

function createChannelState(session) {
  return {
    key: getChannelKey(session),
    session,
    subscribers: new Map(),
    lastOverlay: null,
    lastOverlayHash: "",
    lastPublishedAt: "",
    lastAccessedAt: new Date().toISOString(),
    lastError: null,
    active: false,
    intervalId: null,
    inFlight: null,
  };
}

function ensureChannel(session) {
  const key = getChannelKey(session);
  let channel = overlayChannels.get(key);
  if (!channel) {
    channel = createChannelState(session);
    overlayChannels.set(key, channel);
  } else if (session?.exp && Number(session.exp) > Number(channel.session?.exp || 0)) {
    channel.session = session;
  }
  channel.lastAccessedAt = new Date().toISOString();
  return channel;
}

function removeSubscriber(channel, subscriberId) {
  channel.subscribers.delete(subscriberId);
  channel.lastAccessedAt = new Date().toISOString();
}

function stopChannel(channel) {
  if (channel.intervalId) {
    clearInterval(channel.intervalId);
    channel.intervalId = null;
  }
  channel.active = false;
  channel.inFlight = null;
  if (!channel.subscribers.size) {
    overlayChannels.delete(channel.key);
  }
}

function createSystemRequest(channel) {
  return {
    headers: {},
    query: {},
  };
}

function publishEvent(channel, event) {
  channel.subscribers.forEach((subscriber) => {
    try {
      writeEvent(subscriber.res, event);
    } catch {
      subscriber.close();
    }
  });
}

async function publishOverlay(channel, { force = false } = {}) {
  if (!channel || !channel.subscribers.size) {
    stopChannel(channel);
    return;
  }

  if (isSessionExpired(channel.session)) {
    const heartbeat = createEvent("system.heartbeat", "system", {
      connected: false,
      generatedAt: new Date().toISOString(),
      message: "La sesión del realtime core expiró y debe renovarse",
    });
    publishEvent(channel, heartbeat);
    channel.subscribers.forEach((subscriber) => subscriber.close());
    stopChannel(channel);
    return;
  }

  if (channel.inFlight) {
    return channel.inFlight;
  }

  channel.inFlight = (async () => {
    try {
      const rawOverlay = await buildRealtimeCoreSystemOverlay(createSystemRequest(channel), {
        session: channel.session,
      });
      const overlay = stabilizeOverlay(rawOverlay, channel.lastOverlay);
      const overlayHash = JSON.stringify(overlay);
      const changed = force || overlayHash !== channel.lastOverlayHash;

      channel.lastOverlay = overlay;
      channel.lastOverlayHash = overlayHash;
      channel.lastPublishedAt = new Date().toISOString();
      channel.lastError = null;
      channel.lastAccessedAt = channel.lastPublishedAt;

      if (changed) {
        publishEvent(channel, createEvent("system.overlay.updated", "system", overlay));
      }
      publishEvent(channel, createEvent("system.heartbeat", "system", buildRealtimeCoreHeartbeat(overlay)));
    } catch (error) {
      channel.lastError = error instanceof Error ? error.message : "No se pudo emitir overlay";
      publishEvent(channel, createEvent("system.heartbeat", "system", {
        connected: false,
        generatedAt: new Date().toISOString(),
        message: channel.lastError,
      }));
    } finally {
      channel.inFlight = null;
    }
  })();

  return channel.inFlight;
}

function startChannel(channel) {
  if (channel.active) return;
  channel.active = true;

  void publishOverlay(channel, { force: true });

  channel.intervalId = setInterval(() => {
    if (!channel.subscribers.size) {
      const idleMs = Date.now() - new Date(channel.lastAccessedAt || 0).getTime();
      if (idleMs >= MAX_CHANNEL_IDLE_MS) {
        stopChannel(channel);
      }
      return;
    }
    void publishOverlay(channel);
  }, DEFAULT_POLL_INTERVAL_MS);
}

async function handleBootstrap(req, res, url) {
  const normalizedReq = normalizeRequest(req, url);
  const session = resolveRealtimeCoreSession(normalizedReq);
  if (!session) {
    sendJson(req, res, 401, { message: "Sesión no válida o vencida" });
    return;
  }

  const channel = overlayChannels.get(getChannelKey(session)) || null;
  if (channel && session?.exp && Number(session.exp) > Number(channel.session?.exp || 0)) {
    channel.session = session;
  }
  const payload = await buildRealtimeCoreBootstrap(normalizedReq, { session });

  if (channel?.lastOverlay) {
    payload.system = {
      ...payload.system,
      connection: channel.lastOverlay.connection,
      execution: channel.lastOverlay.execution,
      dashboardSummary: channel.lastOverlay.dashboardSummary,
    };
  }

  sendJson(req, res, 200, payload);
}

async function handleEvents(req, res, url) {
  const normalizedReq = normalizeRequest(req, url);
  const session = resolveRealtimeCoreSession(normalizedReq);
  if (!session) {
    sendJson(req, res, 401, { message: "Sesión no válida o vencida" });
    return;
  }

  const channel = ensureChannel(session);
  const subscriberId = `${channel.key}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

  setCorsHeaders(req, res);
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 1500\n\n");

  let closed = false;

  const closeStream = () => {
    if (closed) return;
    closed = true;
    removeSubscriber(channel, subscriberId);
    try {
      res.end();
    } catch {
      // ignore close errors
    }
  };

  channel.subscribers.set(subscriberId, {
    id: subscriberId,
    res,
    close: closeStream,
  });

  req.on("close", closeStream);
  req.on("aborted", closeStream);

  if (channel.lastOverlay) {
    writeEvent(res, createEvent("system.overlay.updated", "system", channel.lastOverlay));
    writeEvent(res, createEvent("system.heartbeat", "system", buildRealtimeCoreHeartbeat(channel.lastOverlay)));
  }

  startChannel(channel);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "OPTIONS") {
    setCorsHeaders(req, res);
    res.writeHead(204, {
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
    });
    res.end();
    return;
  }

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(req, res, 200, {
        ok: true,
        service: "realtime-core",
        mode: "persistent-memory",
        now: new Date().toISOString(),
        activeChannels: overlayChannels.size,
        activeSubscribers: getSubscriberCount(),
        pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
        channels: getChannelStats(),
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
