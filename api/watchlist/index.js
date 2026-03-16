import { createWatchlist, deleteWatchlist, listWatchlists, replaceWatchlist, sendJson, updateWatchlist } from "../_lib/watchlist.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return sendJson(res, 200, await listWatchlists(req));
    }

    if (req.method === "POST") {
      return sendJson(res, 200, await createWatchlist(req));
    }

    if (req.method === "PATCH") {
      return sendJson(res, 200, await updateWatchlist(req));
    }

    if (req.method === "PUT") {
      return sendJson(res, 200, await replaceWatchlist(req));
    }

    if (req.method === "DELETE") {
      return sendJson(res, 200, await deleteWatchlist(req));
    }

    return sendJson(res, 405, { message: "Método no permitido" });
  } catch (error) {
    return sendJson(res, 400, {
      message: error.message || "No se pudo procesar el watchlist",
    });
  }
}
