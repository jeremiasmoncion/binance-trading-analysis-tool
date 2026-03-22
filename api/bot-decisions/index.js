import { createBotDecision, listBotDecisions, sendJson } from "../_lib/botDecisions.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return sendJson(res, 200, await listBotDecisions(req));
    }

    if (req.method === "POST") {
      return sendJson(res, 200, await createBotDecision(req));
    }

    return sendJson(res, 405, { message: "Método no permitido" });
  } catch (error) {
    return sendJson(res, 400, {
      message: error.message || "No se pudo procesar la decisión del bot",
    });
  }
}
