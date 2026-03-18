import { getWatchlistScannerStatus, runWatchlistScan, sendJson } from "../_lib/watchlistScanner.js";

function isSchedulerRequest(req) {
  const headerToken = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const secret = String(process.env.CRON_SECRET || process.env.WATCHLIST_SCAN_SECRET || "").trim();
  if (secret && headerToken && headerToken === secret) return true;
  return Boolean(req.headers["x-vercel-cron"]);
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      if (isSchedulerRequest(req)) {
        return sendJson(res, 200, await runWatchlistScan(req));
      }
      return sendJson(res, 200, await getWatchlistScannerStatus(req));
    }

    if (req.method === "POST") {
      return sendJson(res, 200, await runWatchlistScan(req));
    }

    return sendJson(res, 405, { message: "Método no permitido" });
  } catch (error) {
    return sendJson(res, 400, {
      message: error.message || "No se pudo ejecutar el vigilante del watchlist",
    });
  }
}
