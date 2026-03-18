import { getSession, sendJson } from "../_lib/auth.js";
import { processQueuedStrategyBacktests, processQueuedStrategyBacktestsGlobally } from "../_lib/strategyEngine.js";

function isSchedulerRequest(req) {
  const headerToken = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const secret = String(process.env.CRON_SECRET || process.env.WATCHLIST_SCAN_SECRET || "").trim();
  if (secret && headerToken && headerToken === secret) return true;
  return Boolean(req.headers["x-vercel-cron"]);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return sendJson(res, 405, { message: "Método no permitido" });
    }

    if (isSchedulerRequest(req)) {
      return sendJson(res, 200, await processQueuedStrategyBacktestsGlobally({
        limit: 1,
        triggerSource: "scheduler-backtest-runner",
      }));
    }

    const session = getSession(req);
    if (!session) {
      throw new Error("No autorizado para procesar la cola de backtesting");
    }

    return sendJson(res, 200, await processQueuedStrategyBacktests(req));
  } catch (error) {
    return sendJson(res, 400, {
      message: error.message || "No se pudo procesar la cola de backtesting",
    });
  }
}
