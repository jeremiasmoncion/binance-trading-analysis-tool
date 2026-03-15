import { listWatchlist, replaceWatchlist, sendJson } from "../_lib/watchlist.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return sendJson(res, 200, { coins: await listWatchlist(req) });
    }

    if (req.method === "PUT") {
      return sendJson(res, 200, { coins: await replaceWatchlist(req) });
    }

    return sendJson(res, 405, { message: "Método no permitido" });
  } catch (error) {
    return sendJson(res, 400, {
      message: error.message || "No se pudo procesar el watchlist",
    });
  }
}
