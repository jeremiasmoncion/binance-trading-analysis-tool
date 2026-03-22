import { createBot, listBots, sendJson } from "../_lib/bots.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return sendJson(res, 200, await listBots(req));
    }

    if (req.method === "POST") {
      return sendJson(res, 200, await createBot(req));
    }

    return sendJson(res, 405, { message: "Método no permitido" });
  } catch (error) {
    return sendJson(res, 400, {
      message: error.message || "No se pudo procesar el registro de bots",
    });
  }
}
