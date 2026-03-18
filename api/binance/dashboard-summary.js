import {
  getExecutionDashboardSummary,
  sendJson,
} from "../_lib/executionEngine.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return sendJson(res, 200, await getExecutionDashboardSummary(req));
    }

    return sendJson(res, 405, { message: "Método no permitido" });
  } catch (error) {
    return sendJson(res, 400, {
      message: error.message || "No se pudo leer el resumen del dashboard",
    });
  }
}
