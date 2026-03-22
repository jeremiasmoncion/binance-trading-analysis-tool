import { sendJson, updateBot } from "../_lib/bots.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "PATCH") {
      return sendJson(res, 405, { message: "Método no permitido" });
    }

    const id = typeof req.query?.id === "string" ? req.query.id : "";
    if (!id) {
      return sendJson(res, 400, { message: "Falta el identificador del bot" });
    }

    return sendJson(res, 200, await updateBot(req, id));
  } catch (error) {
    return sendJson(res, 400, {
      message: error.message || "No se pudo actualizar el bot",
    });
  }
}
