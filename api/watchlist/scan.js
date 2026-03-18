import { getWatchlistScannerStatus, runWatchlistScan, sendJson } from "../_lib/watchlistScanner.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
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
