import { sendJson, updateBotDecision } from "../_lib/botDecisions.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "PATCH") {
      return sendJson(res, 405, { message: "Método no permitido" });
    }

    const id = typeof req.query?.id === "string" ? req.query.id : "";
    if (!id) {
      return sendJson(res, 400, { message: "Falta el identificador de la decisión" });
    }

    return sendJson(res, 200, await updateBotDecision(req, id));
  } catch (error) {
    return sendJson(res, 400, {
      message: error.message || "No se pudo actualizar la decisión del bot",
    });
  }
}
