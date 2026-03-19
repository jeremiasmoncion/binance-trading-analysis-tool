import { sendJson } from "../_lib/auth.js";
import { buildRealtimeCoreBootstrap } from "../_lib/realtimeCore.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return sendJson(res, 200, await buildRealtimeCoreBootstrap(req));
    }

    return sendJson(res, 405, { message: "Método no permitido" });
  } catch (error) {
    return sendJson(res, 400, {
      message: error.message || "No se pudo inicializar el realtime core",
    });
  }
}
